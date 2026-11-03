import 'server-only';
import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { repositoryCatalog, type RepositoryDefinition } from '@/config/repositories';
import { matchesCurrentPr } from '@/lib/presentation/repository-records';
import { notConnected, type Count } from '@/models/reporting-measurement';
import type { ReportingAccountType } from '@/models/repository-insights';
import {
  agingThresholds,
  backlogMetricIds,
  backlogSchema,
  reportingBranchSchema,
  type BacklogMetric,
  type RepositoryBacklog,
} from '@/models/repository-overview';
import type { LatestRecordActivity } from '@/models/repository-page';
import type { LatestActor } from '@/models/repository-records';
import { sampleRecordSource, type RepositoryRecordSource } from '@/mocks/record-source';
import { openPullRequestRows } from '@/mocks/repository-records';
import {
  byText,
  type WorldActorType,
  type WorldPullRequest,
  type WorldRepository,
  type WorldReview,
} from '@/mocks/repository-world';

/**
 * Repository records from a github-activity-db SQLite file. The file is GitHub's current state as
 * the database mirrors it; every count, credit and classification here is the dashboard's own
 * reading of those rows, as the product definitions specify. What the file does not hold yet is
 * marked not connected, never counted as zero.
 */

/** `PRAGMA user_version` of the database contract this reader understands. */
export const activityDatabaseSchemaVersion = 2;
/** The database's coverage floor: pull requests merged or closed before it are not stored. */
export const activityDatabaseFloor = '2023-01-01T00:00:00.000Z';

export const notConnectedReasons = {
  issues: 'Issues are not collected by github-activity-db yet.',
  agents: 'The Prebid agent account mapping is not connected yet.',
  reviewers: 'The Prebid reviewer mapping is not connected yet.',
  history:
    'github-activity-db stores current state only, so backlog at past dates is not connected yet.',
  private:
    'This private repository is synced only by the scheduled database run, which is not connected yet.',
  unsynced: 'This repository has not been synced into the activity database yet.',
} as const;

type GithubType = 'User' | 'Bot' | 'Organization' | 'Mannequin' | 'EnterpriseUserAccount';
/** A stored GitHub account; `id` is stable across logins: its GitHub id, or node id without one. */
export interface Account {
  id: string;
  login: string;
  name: string | null;
  type: GithubType;
}
/** What contribution reports read about one pull request beyond its repository-view reading. */
export interface PullRequestFacts {
  record: WorldPullRequest;
  repositoryId: string;
  primaryBranch: string;
  author: Account | null;
  merger: Account | null;
  diff: {
    additions: number;
    deletions: number;
    changedFiles: number;
    filesTotal: number;
    files: ReadonlyMap<string, number>;
  };
  comments: readonly { githubId: number; account: Account | null; at: string }[];
  /** Non-author accounts with a dismissed review, whose earlier state GitHub no longer reports. */
  dismissed: readonly Account[];
}
interface Review {
  reviewer: number | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
  at: string;
  inline: number;
}
interface Event {
  actor: number | null;
  at: string;
}

/** SQLAlchemy's fixed-width UTC text, `YYYY-MM-DD HH:MM:SS.ffffff`, as an ISO instant. */
export function databaseInstant(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/.exec(value);
  if (!match) throw new Error('Unexpected timestamp in the activity database: ' + value);
  const instant =
    match[1] + 'T' + match[2] + '.' + (match[3] ?? '').padEnd(3, '0').slice(0, 3) + 'Z';
  if (Number.isNaN(Date.parse(instant))) throw new Error('Invalid timestamp: ' + value);
  return instant;
}

function actorType(account: Account | undefined): WorldActorType | null {
  if (!account) return null;
  if (account.type === 'Bot') return 'bot';
  return account.type === 'User' ? 'human' : null;
}

function rows<T>(database: DatabaseSync, sql: string, ...parameters: (string | number)[]): T[] {
  return database.prepare(sql).all(...parameters) as T[];
}

function groupBy<T>(items: readonly T[], key: (item: T) => number) {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const id = key(item);
    const group = groups.get(id);
    if (group) group.push(item);
    else groups.set(id, [item]);
  }
  return groups;
}

interface PullRequestRow {
  id: number;
  repository_id: number;
  number: number;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  is_draft: number;
  title: string;
  author_id: number | null;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
  base_ref: string;
  merged_by_id: number | null;
  additions: number;
  deletions: number;
  changed_files: number;
  files_total: number;
}

/**
 * One pull request as the repository views read it. Feedback is a conversation comment, a
 * submitted comment review, a change request, or an approval carrying inline comments, by an
 * account other than the author; an approval alone is approval, not feedback. A dismissed
 * review's earlier state is not stored, so it counts as feedback only through its inline comments
 * and its pull request's approval history is unknown.
 */
function pullRequest(
  row: PullRequestRow,
  repository: RepositoryDefinition,
  context: {
    asOf: string;
    accounts: ReadonlyMap<number, Account>;
    labels: readonly string[];
    reviews: readonly Review[];
    comments: readonly Event[];
    lastCommitAt: string | null;
  },
): WorldPullRequest {
  const { asOf, accounts } = context;
  const within = (at: string | null) => at !== null && at <= asOf;
  const author = row.author_id === null ? undefined : accounts.get(row.author_id);
  const authorType = actorType(author);
  const createdAt = databaseInstant(row.created_at);
  const mergedAt = row.merged_at && databaseInstant(row.merged_at);
  const closedAt = row.closed_at && databaseInstant(row.closed_at);
  // A merge or close after the reporting clock happened after the data this view states.
  const state =
    row.state === 'MERGED' && within(mergedAt)
      ? ('Merged' as const)
      : row.state === 'CLOSED' && within(closedAt)
        ? ('Closed' as const)
        : ('Open' as const);
  const reviews = context.reviews.filter((review) => within(review.at));
  const comments = context.comments.filter((comment) => within(comment.at));
  const events: WorldReview[] = [];
  let approvalHistoryKnown = true;
  const other = (actor: number | null) => actor !== null && actor !== row.author_id;
  for (const review of reviews) {
    if (review.state === 'DISMISSED') approvalHistoryKnown = false;
    const account = review.reviewer === null ? undefined : accounts.get(review.reviewer);
    const type = actorType(account);
    if (!other(review.reviewer) || !account || !type) continue;
    if (review.state === 'COMMENTED' || review.state === 'CHANGES_REQUESTED' || review.inline > 0)
      events.push({
        account: account.login,
        actorType: type,
        kind: 'review',
        at: review.at,
        dismissedAt: null,
      });
    if (review.state === 'APPROVED')
      events.push({
        account: account.login,
        actorType: type,
        kind: 'approval',
        at: review.at,
        dismissedAt: null,
      });
  }
  for (const comment of comments) {
    const account = comment.actor === null ? undefined : accounts.get(comment.actor);
    const type = actorType(account);
    if (!other(comment.actor) || !account || !type) continue;
    events.push({
      account: account.login,
      actorType: type,
      kind: 'review',
      at: comment.at,
      dismissedAt: null,
    });
  }
  events.sort((a, b) => byText(a.at, b.at));
  const humanReviewers = new Set(
    events
      .filter((event) => event.actorType === 'human' && event.kind === 'review')
      .map((event) => event.account),
  ).size;
  // A reviewer's latest approving, change-requesting or dismissed review is their current state.
  const current = new Map<string, Review['state']>();
  for (const review of [...reviews].sort((a, b) => byText(a.at, b.at))) {
    const account = review.reviewer === null ? undefined : accounts.get(review.reviewer);
    if (!other(review.reviewer) || !account || actorType(account) !== 'human') continue;
    if (review.state !== 'COMMENTED') current.set(account.login, review.state);
  }
  const approvals = [...current.values()].filter((state) => state === 'APPROVED').length;
  const latestActivity = latest(
    row,
    author,
    authorType,
    { ...context, reviews, comments },
    createdAt,
  );
  return {
    id: repository.id + '-pr-' + row.number,
    number: row.number,
    title: row.title,
    url: repository.url + '/pull/' + row.number,
    author: author?.login ?? 'ghost',
    authorType,
    createdAt,
    labels: [...context.labels],
    latestActivity,
    state,
    draft: state === 'Open' && row.is_draft === 1,
    mergedAt: state === 'Merged' ? mergedAt : null,
    closedAt: state === 'Closed' ? closedAt : null,
    baseBranch: row.base_ref,
    reviews: events,
    humanReviewers,
    approvals,
    // The Prebid agent mapping is not connected, so agent coverage is unknown.
    agentReviewer: null,
    botReviewer: events.some((event) => event.actorType === 'bot' && event.kind === 'review'),
    latestActor: latestActivity.category,
    approvalHistoryKnown,
  };
}

/**
 * The latest attributable event: a submitted review, a conversation comment, the latest commit,
 * or the opening. GitHub records who wrote a commit, not who pushed it, so a commit as the latest
 * event has an unknown actor. A non-author human is "other human" until the Prebid reviewer
 * mapping can tell reviewers apart.
 */
function latest(
  row: PullRequestRow,
  author: Account | undefined,
  authorType: WorldActorType | null,
  context: {
    asOf: string;
    accounts: ReadonlyMap<number, Account>;
    reviews: readonly Review[];
    comments: readonly Event[];
    lastCommitAt: string | null;
  },
  createdAt: string,
): LatestRecordActivity & { category: LatestActor } {
  let at = createdAt,
    actor: number | null | 'commit' = row.author_id;
  for (const event of [
    ...context.reviews.map((review) => ({ actor: review.reviewer, at: review.at })),
    ...context.comments,
  ])
    if (event.at > at) ({ at, actor } = event);
  if (context.lastCommitAt && context.lastCommitAt <= context.asOf && context.lastCommitAt > at) {
    at = context.lastCommitAt;
    actor = 'commit';
  }
  if (actor === 'commit' || actor === null) return { at, account: null, category: 'unknown' };
  const account = context.accounts.get(actor);
  const type = actorType(account);
  if (!account || !type) return { at, account: account?.login ?? null, category: 'unknown' };
  if (type === 'bot') return { at, account: account.login, category: 'bot' };
  if (actor === row.author_id)
    return {
      at,
      account: author?.login ?? null,
      category: authorType === 'bot' ? 'bot' : 'contributor',
    };
  return { at, account: account.login, category: 'other-human' };
}

const countOf = (value: number): Count => ({ status: 'complete', value });

/** The Summary's current backlog, counted from the same open rows the current record lists show. */
export function databaseBacklog(repository: WorldRepository, asOf: string): RepositoryBacklog {
  const unconnected = repository.notConnected?.pullRequests;
  const open = unconnected ? [] : openPullRequestRows(repository, asOf);
  const count = (metric: Exclude<BacklogMetric, 'openIssues'>): Count =>
    unconnected
      ? notConnected(unconnected)
      : countOf(open.filter((row) => matchesCurrentPr(row, { scope: 'current', metric })).length);
  const counts = Object.fromEntries(
    backlogMetricIds.map((metric): [BacklogMetric, Count] => {
      if (metric === 'openIssues')
        return [
          metric,
          notConnected(repository.notConnected?.issues ?? notConnectedReasons.issues),
        ];
      if (!unconnected && (metric === 'agentFeedbackPrs' || metric === 'lastAgent'))
        return [metric, notConnected(notConnectedReasons.agents)];
      if (!unconnected && metric === 'lastPrebidReviewer')
        return [metric, notConnected(notConnectedReasons.reviewers)];
      const value = count(metric);
      if (metric === 'lastOtherHuman' && value.status === 'complete')
        return [
          metric,
          {
            status: 'partial',
            value: value.value,
            reason: 'Includes Prebid reviewers until the Prebid reviewer mapping is connected.',
          },
        ];
      return [metric, value];
    }),
  ) as RepositoryBacklog['counts'];
  const agedPrs = Object.fromEntries(
    agingThresholds.map((ageDays) => [
      ageDays,
      unconnected
        ? notConnected(unconnected)
        : countOf(
            open.filter((row) =>
              matchesCurrentPr(row, { scope: 'current', metric: 'agedPrs', ageDays }),
            ).length,
          ),
    ]),
  ) as RepositoryBacklog['agedPrs'];
  return backlogSchema.parse({ counts, agedPrs });
}

export interface LoadedDatabase {
  asOf: string;
  runId: number;
  repositories: Map<string, WorldRepository>;
  accounts: Map<string, ReportingAccountType>;
  /** Every stored account and pull request of a connected repository, for contribution reports. */
  accountDirectory: readonly Account[];
  pullRequests: readonly PullRequestFacts[];
  /** Enabled catalog repositories whose pull requests are not connected, with the reason. */
  unconnected: ReadonlyMap<string, string>;
}

function load(path: string): LoadedDatabase {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const { user_version: version } = database.prepare('PRAGMA user_version').get() as {
      user_version: number;
    };
    if (version !== activityDatabaseSchemaVersion)
      throw new Error(
        'The activity database has schema version ' +
          version +
          '; this dashboard reads version ' +
          activityDatabaseSchemaVersion +
          '.',
      );
    const run = database
      .prepare(
        "SELECT id, started_at, finished_at FROM sync_runs WHERE status <> 'running' AND finished_at IS NOT NULL AND exit_code IN (0, 2) ORDER BY finished_at DESC LIMIT 1",
      )
      .get() as { id: number; started_at: string; finished_at: string } | undefined;
    if (!run) throw new Error('The activity database has no finished sync run.');
    const stored = new Map(
      rows<{
        id: number;
        github_id: number;
        default_branch: string;
        last_outcome: string | null;
        last_index_started_at: string | null;
      }>(
        database,
        'SELECT r.id, r.github_id, r.default_branch, s.last_outcome, s.last_index_started_at FROM repositories r LEFT JOIN repo_sync_state s ON s.repository_id = r.id',
      ).map((row) => [String(row.github_id), row]),
    );
    // Each repository's rows are GitHub's state when its index started, so the report states the
    // earliest such start among the repositories it reads; later events and records are ignored.
    const indexStarts = repositoryCatalog
      .filter((entry) => entry.enabled)
      .map((entry) => stored.get(entry.githubId))
      .filter((row) => row?.last_outcome === 'complete')
      .map((row) => row!.last_index_started_at ?? run.started_at);
    const clock = indexStarts.length
      ? indexStarts.reduce((a, b) => (b < a ? b : a))
      : run.started_at;
    const asOf = databaseInstant(clock);
    const accounts = new Map<number, Account>(
      rows<{
        id: number;
        github_id: number | null;
        node_id: string;
        login: string;
        name: string | null;
        type: GithubType;
      }>(database, 'SELECT id, github_id, node_id, login, name, type FROM github_users').map(
        (row) => [
          row.id,
          {
            id: 'account-' + (row.github_id ?? row.node_id),
            login: row.login,
            name: row.name,
            type: row.type,
          },
        ],
      ),
    );
    const pullRequests = groupBy(
      rows<PullRequestRow>(
        database,
        'SELECT id, repository_id, number, state, is_draft, title, author_id, created_at, merged_at, closed_at, base_ref, merged_by_id, additions, deletions, changed_files, files_total FROM pull_requests WHERE created_at <= ?',
        clock,
      ),
      (row) => row.repository_id,
    );
    const labels = groupBy(
      rows<{ pr_id: number; name: string }>(
        database,
        'SELECT pr_id, name FROM pr_labels ORDER BY pr_id, name',
      ),
      (row) => row.pr_id,
    );
    const reviews = groupBy(
      rows<{
        pr_id: number;
        reviewer_id: number | null;
        state: Review['state'];
        at: string;
        inline: number;
      }>(
        database,
        'SELECT pr_id, reviewer_id, state, COALESCE(submitted_at, created_at) AS at, inline_comments_total AS inline FROM pr_reviews',
      ),
      (row) => row.pr_id,
    );
    const comments = groupBy(
      rows<{ pr_id: number; github_id: number; author_id: number | null; created_at: string }>(
        database,
        'SELECT pr_id, github_id, author_id, created_at FROM pr_comments',
      ),
      (row) => row.pr_id,
    );
    const files = groupBy(
      rows<{ pr_id: number; change_type: string; count: number }>(
        database,
        'SELECT pr_id, change_type, COUNT(*) AS count FROM pr_files GROUP BY pr_id, change_type',
      ),
      (row) => row.pr_id,
    );
    const facts: PullRequestFacts[] = [];
    const unconnectedRepositories = new Map<string, string>();
    const commits = new Map(
      rows<{ pr_id: number; last: string }>(
        database,
        'SELECT pr_id, MAX(authored_at) AS last FROM pr_commits GROUP BY pr_id',
      ).map((row) => [row.pr_id, databaseInstant(row.last)]),
    );
    const availability = [{ start: activityDatabaseFloor, end: asOf, endInclusive: true }];
    const repositories = new Map<string, WorldRepository>();
    for (const definition of repositoryCatalog.filter((entry) => entry.enabled)) {
      const row = stored.get(definition.githubId);
      const branch = reportingBranchSchema.safeParse(row?.default_branch);
      const base = {
        id: definition.id,
        slug: definition.slug,
        name: definition.displayName,
        primaryBranch: branch.success
          ? branch.data
          : reportingBranchSchema.parse(definition.primaryBranch),
        availability,
        issues: [],
      };
      const unconnected =
        definition.name === 'prebid-agent-skills' && !row
          ? notConnectedReasons.private
          : !row || row.last_outcome !== 'complete'
            ? notConnectedReasons.unsynced
            : undefined;
      if (unconnected || !row) {
        unconnectedRepositories.set(definition.id, unconnected ?? notConnectedReasons.unsynced);
        repositories.set(definition.id, {
          ...base,
          pullRequests: [],
          notConnected: {
            pullRequests: unconnected ?? notConnectedReasons.unsynced,
            issues: notConnectedReasons.issues,
            agents: notConnectedReasons.agents,
            history: notConnectedReasons.history,
          },
        });
        continue;
      }
      const account = (id: number | null) => (id === null ? null : (accounts.get(id) ?? null));
      const records = (pullRequests.get(row.id) ?? [])
        .map((pr) => {
          const prReviews = (reviews.get(pr.id) ?? []).map((review) => ({
            reviewer: review.reviewer_id,
            state: review.state,
            at: databaseInstant(review.at),
            inline: review.inline,
          }));
          const prComments = (comments.get(pr.id) ?? []).map((comment) => ({
            githubId: comment.github_id,
            actor: comment.author_id,
            at: databaseInstant(comment.created_at),
          }));
          const record = pullRequest(pr, definition, {
            asOf,
            accounts,
            labels: (labels.get(pr.id) ?? []).map((label) => label.name),
            reviews: prReviews,
            comments: prComments,
            lastCommitAt: commits.get(pr.id) ?? null,
          });
          const dismissed = new Map<string, Account>();
          for (const review of prReviews) {
            const reviewer = account(review.reviewer);
            if (review.state === 'DISMISSED' && review.at <= asOf && reviewer)
              if (review.reviewer !== pr.author_id) dismissed.set(reviewer.id, reviewer);
          }
          facts.push({
            record,
            repositoryId: definition.id,
            primaryBranch: base.primaryBranch,
            author: account(pr.author_id),
            merger: record.state === 'Merged' ? account(pr.merged_by_id) : null,
            diff: {
              additions: pr.additions,
              deletions: pr.deletions,
              changedFiles: pr.changed_files,
              filesTotal: pr.files_total,
              files: new Map(
                (files.get(pr.id) ?? []).map((file) => [file.change_type, file.count]),
              ),
            },
            comments: prComments
              .filter((comment) => comment.at <= asOf)
              .map((comment) => ({
                githubId: comment.githubId,
                account: account(comment.actor),
                at: comment.at,
              })),
            dismissed: [...dismissed.values()],
          });
          return record;
        })
        .sort((a, b) => byText(a.createdAt, b.createdAt) || a.number - b.number);
      repositories.set(definition.id, {
        ...base,
        pullRequests: records,
        notConnected: {
          issues: notConnectedReasons.issues,
          agents: notConnectedReasons.agents,
          history: notConnectedReasons.history,
        },
      });
    }
    const types = new Map<string, ReportingAccountType>();
    for (const account of accounts.values())
      types.set(account.login.toLowerCase(), account.type === 'Bot' ? 'bot' : 'human');
    return {
      asOf,
      runId: run.id,
      repositories,
      accounts: types,
      accountDirectory: [...accounts.values()],
      pullRequests: facts,
      unconnected: unconnectedRepositories,
    };
  } finally {
    database.close();
  }
}

function databaseSource(loaded: LoadedDatabase): RepositoryRecordSource {
  const backlogs = new Map<string, RepositoryBacklog>();
  return {
    kind: 'database',
    scenarioId: 'github-activity-db-run-' + loaded.runId,
    asOf: loaded.asOf,
    repositories: () => loaded.repositories,
    backlog(repositoryId) {
      let backlog = backlogs.get(repositoryId);
      if (!backlog) {
        const repository = loaded.repositories.get(repositoryId);
        if (!repository) throw new Error('Unknown repository');
        backlog = databaseBacklog(repository, loaded.asOf);
        backlogs.set(repositoryId, backlog);
      }
      return backlog;
    },
    // Unknown accounts read as human here only for author lists; record rows keep null.
    accountType: (login) => loaded.accounts.get(login.toLowerCase()) ?? 'human',
    profileUrl: (login) => 'https://github.com/' + encodeURIComponent(login),
  };
}

let cached: { key: string; loaded: LoadedDatabase; source: RepositoryRecordSource } | undefined;
/** The activity database at `path`, read once per change to its size or modification time. */
export function activityDatabase(path: string) {
  const stat = statSync(path);
  const key = path + ':' + stat.size + ':' + stat.mtimeMs;
  if (cached?.key !== key) {
    const loaded = load(path);
    cached = { key, loaded, source: databaseSource(loaded) };
  }
  return cached;
}
/**
 * The record source repository views read: the activity database named by
 * `DASHBOARD_ACTIVITY_DATABASE`, or the prepared samples when it is unset. A configured database
 * that cannot be read is an error, never a silent fallback to samples.
 */
export function repositoryRecords(
  path = process.env.DASHBOARD_ACTIVITY_DATABASE,
): RepositoryRecordSource {
  return path ? activityDatabase(path).source : sampleRecordSource;
}

/**
 * The clock repository navigation links resolve saved periods against. The masthead must render
 * when the database cannot be read, so it falls back to the sample clock; the pages that read
 * records still report the error.
 */
export function repositoryClock(): string {
  try {
    return repositoryRecords().asOf;
  } catch {
    return sampleRecordSource.asOf;
  }
}
