import 'server-only';
import { repositoryCatalog } from '@/config/repositories';
import { validateContributionSource } from '@/lib/presentation/contribution-source';
import { inDateRange, resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import { timelineRangeCoverage } from '@/lib/presentation/reporting-timeline';
import type { CompanyMapping } from '@/models/company-mapping';
import {
  additionalMetricIds,
  changeStatIds,
  type ChangeStat,
  type ChangeStats,
} from '@/models/contribution-activity';
import type { ContributionDirectory } from '@/models/contribution-settings';
import {
  contributionMetricIds,
  type ContributionAccount,
  type ContributionCoverage,
  type ContributionCredit,
  type ContributionMetric,
  type ContributionRecord,
  type ContributionSource,
} from '@/models/contributions';
import { githubLoginSchema, normalizeGithubLogin } from '@/models/github-account';
import { reportingBranchSchema } from '@/models/repository-overview';
import type { PeriodSelection } from '@/models/reporting-period';
import type { Count } from '@/models/reporting-measurement';
import {
  sampleContributionRecords,
  type ContributionRecordSource,
} from '@/mocks/contribution-records';
import {
  activityData,
  activityDatabaseFloor,
  notConnectedReasons,
  type Account,
  type LoadedDatabase,
  type PullRequestFacts,
} from './activity-database';
import { companyMapping } from './company-mapping';

/**
 * Contribution reports from the activity database: the repository views' reading of each pull
 * request, credited once per account, record and metric at its first qualifying date (see the
 * contribution contract in docs/product/contributors.md). Companies come from the company mapping
 * (`companyMapping()`) when one is connected: an account it lists by lowercased login belongs to
 * that company, and every other account is Unmapped. Issues, inline and issue comments and the
 * Prebid agent mapping are not connected yet.
 */

export const companyNotConnected = 'Company mapping not connected';
const dismissedReason =
  'GitHub no longer reports what a dismissed review was, so an approval or change request may be missing.';
const fileStatuses: Partial<Record<string, ChangeStat>> = {
  ADDED: 'filesAdded',
  DELETED: 'filesRemoved',
  MODIFIED: 'filesModified',
  RENAMED: 'filesRenamed',
  COPIED: 'filesCopied',
  CHANGED: 'filesTypeChanged',
};

function contributionAccount(
  account: Account,
  companies: ReadonlyMap<string, string>,
): ContributionAccount | null {
  if (!githubLoginSchema.safeParse(account.login).success) return null;
  return {
    id: account.id,
    login: account.login,
    profileUrl: 'https://github.com/' + encodeURIComponent(account.login),
    name: account.name?.trim().slice(0, 200) || account.login,
    actorType: account.type === 'User' ? 'human' : account.type === 'Bot' ? 'bot' : 'unknown',
    companyId: companies.get(normalizeGithubLogin(account.login)) ?? null,
  };
}

/** The final merged diff as GitHub reports it; file statuses are partial when GitHub listed fewer files. */
function mergedDiff(diff: PullRequestFacts['diff']): ChangeStats {
  const complete = (value: number): Count => ({ status: 'complete', value });
  const statuses = Object.fromEntries(
    Object.values(fileStatuses).map((stat) => [stat!, 0]),
  ) as Record<ChangeStat, number>;
  let listed = 0;
  for (const [status, count] of diff.files) {
    listed += count;
    const stat = fileStatuses[status];
    if (stat) statuses[stat] += count;
  }
  const fileStatus = (value: number): Count =>
    listed >= diff.filesTotal
      ? complete(value)
      : {
          status: 'partial',
          value,
          reason: `GitHub listed ${listed} of this pull request's ${diff.filesTotal} files.`,
        };
  // GitHub counts a path its file list repeats once, so its total and its list can disagree.
  const classified = Object.values(statuses).reduce((sum, count) => sum + count, 0);
  const filesChanged: Count =
    classified === diff.changedFiles
      ? complete(diff.changedFiles)
      : {
          status: 'partial',
          value: diff.changedFiles,
          reason: `GitHub reports ${diff.changedFiles} changed files and classifies ${classified} listed files.`,
        };
  return Object.fromEntries(
    changeStatIds.map((stat): [ChangeStat, Count] => [
      stat,
      stat === 'filesChanged'
        ? filesChanged
        : stat === 'linesAdded'
          ? complete(diff.additions)
          : stat === 'linesRemoved'
            ? complete(diff.deletions)
            : stat === 'linesChanged'
              ? complete(diff.additions + diff.deletions)
              : fileStatus(statuses[stat]),
    ]),
  ) as ChangeStats;
}

interface History {
  accounts: ContributionAccount[];
  records: ContributionRecord[];
  credits: ContributionCredit[];
  comments: ContributionSource['activity']['comments'];
  volumes: ContributionSource['activity']['volumes'];
  overrides: ContributionSource['coverageOverrides'];
}

/** Every credit, comment and merged volume in the file, before a report selects its range. */
function history(loaded: LoadedDatabase, companies: ReadonlyMap<string, string>): History {
  const accounts = new Map<string, ContributionAccount>();
  const byLogin = new Map<string, string>();
  for (const account of loaded.accountDirectory) {
    const row = contributionAccount(account, companies);
    if (!row) continue;
    accounts.set(row.id, row);
    if (!byLogin.has(row.login.toLowerCase())) byLogin.set(row.login.toLowerCase(), row.id);
  }
  const known = (account: Account | null) =>
    account && accounts.has(account.id) ? account.id : null;
  const records: ContributionRecord[] = [],
    credits: ContributionCredit[] = [],
    comments: History['comments'] = [],
    volumes: History['volumes'] = [];
  const overrides = new Map<string, History['overrides'][number]>();
  const credit = (
    accountId: string | null,
    recordId: string,
    metric: ContributionMetric,
    at: string,
  ) => {
    if (accountId) credits.push({ accountId, recordId, metric, creditedAt: at });
  };
  for (const fact of loaded.pullRequests) {
    const { record } = fact;
    const authorId = known(fact.author),
      mergerId = known(fact.merger);
    const merged = record.state === 'Merged' ? record.mergedAt : null;
    // Change volumes, like merge credits, count only merges into the primary branch.
    const primaryMerge = merged && record.baseBranch === fact.primaryBranch ? merged : null;
    records.push({
      kind: 'pr',
      id: record.id,
      repositoryId: fact.repositoryId,
      number: record.number,
      title: record.title.trim().slice(0, 500) || 'Untitled pull request',
      url: record.url,
      authorId,
      createdAt: record.createdAt,
      state: record.state,
      draft: record.draft,
      baseBranch: record.baseBranch,
      mergedAt: merged,
      mergerId: merged ? mergerId : null,
      ...(merged && { mergedDiff: mergedDiff(fact.diff) }),
    });
    credit(authorId, record.id, 'prsAuthored', record.createdAt);
    if (primaryMerge) {
      credit(authorId, record.id, 'authoredPrsMerged', primaryMerge);
      credit(mergerId, record.id, 'mergesPerformed', primaryMerge);
    }
    const first = new Map<string, string>();
    for (const event of record.reviews) {
      const accountId = byLogin.get(event.account.toLowerCase());
      const metric: ContributionMetric =
        event.kind === 'review' ? 'reviewerContributions' : 'approvalContributions';
      if (!accountId || first.has(accountId + ':' + metric)) continue;
      first.set(accountId + ':' + metric, event.at);
      credit(accountId, record.id, metric, event.at);
      if (primaryMerge && event.at <= primaryMerge)
        volumes.push({
          accountId,
          recordId: record.id,
          role: metric === 'reviewerContributions' ? 'reviewed' : 'approved',
          qualifiedAt: event.at,
        });
    }
    if (primaryMerge && authorId)
      volumes.push({
        accountId: authorId,
        recordId: record.id,
        role: 'authored',
        qualifiedAt: record.createdAt,
      });
    for (const comment of fact.comments) {
      const accountId = known(comment.account);
      if (accountId)
        comments.push({
          id: 'pr-comment-' + comment.githubId,
          accountId,
          recordId: record.id,
          kind: 'prComments',
          createdAt: comment.at,
        });
    }
    for (const account of fact.dismissed) {
      const accountId = known(account);
      if (!accountId) continue;
      for (const metric of ['reviewerContributions', 'approvalContributions'] as const)
        overrides.set([accountId, fact.repositoryId, metric].join(':'), {
          accountId,
          repositoryId: fact.repositoryId,
          metric,
          coverage: { status: 'partial', reason: dismissedReason },
        });
    }
  }
  return {
    accounts: [...accounts.values()],
    records,
    credits,
    comments,
    volumes,
    overrides: [...overrides.values()],
  };
}

/**
 * Contribution reports over `loaded`. With a company mapping, attribution is the current mapping and
 * the companies are those its accounts in this file belong to; without one, company attribution is
 * not connected and every account is Unmapped.
 */
export function databaseContributions(
  loaded: LoadedDatabase,
  mapping: CompanyMapping | null,
): ContributionRecordSource {
  // A Map, so a login that names an Object prototype property is never read as mapped.
  const all = history(loaded, new Map(Object.entries(mapping?.accounts ?? {})));
  const referenced = new Set(all.accounts.map((account) => account.companyId));
  const companies = (mapping?.companies ?? []).filter((company) => referenced.has(company.id));
  const companyAttribution = mapping ? 'current-mapping' : 'not-connected';
  const repositories = repositoryCatalog
    .filter((row) => row.enabled)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.displayName,
      primaryBranch: reportingBranchSchema.parse(
        loaded.repositories.get(row.id)?.primaryBranch ?? row.primaryBranch,
      ),
    }));
  const availability = [{ start: activityDatabaseFloor, end: loaded.asOf, endInclusive: true }];
  const unconnected = [...loaded.unconnected.keys()]
    .map((id) => repositoryCatalog.find((row) => row.id === id)!.displayName)
    .join(', ');
  const scenarioId = 'github-activity-db-run-' + loaded.runId;
  const reports = new Map<string, ContributionSource>();
  function report(period: PeriodSelection): ContributionSource {
    const key = JSON.stringify(period);
    const cached = reports.get(key);
    if (cached) return cached;
    const { range } = resolveReportingPeriod(period, loaded.asOf);
    const dated = timelineRangeCoverage(range, availability);
    // A repository that is not connected leaves every total that could include it incomplete.
    const coverage: ContributionCoverage =
      dated.status !== 'complete' || !unconnected
        ? dated
        : { status: 'partial', reason: 'Not connected yet: ' + unconnected + '.' };
    const notConnected = (reason: string): ContributionCoverage => ({
      status: 'missing',
      reason,
      notConnected: true,
    });
    const credits = all.credits.filter((row) => inDateRange(row.creditedAt, range));
    const comments = all.comments.filter((row) => inDateRange(row.createdAt, range));
    const mergedAt = new Map(
      all.records.map((row) => [row.id, row.kind === 'pr' ? row.mergedAt : null]),
    );
    const volumes = all.volumes.filter((row) => {
      const at = mergedAt.get(row.recordId);
      return at != null && inDateRange(at, range);
    });
    const ids = new Set([...credits, ...comments, ...volumes].map((row) => row.recordId));
    const source = validateContributionSource({
      source: 'database',
      scenarioId,
      asOf: loaded.asOf,
      companyAttribution,
      period,
      range,
      accounts: all.accounts,
      companies,
      repositories,
      records: all.records.filter((row) => ids.has(row.id)),
      credits,
      activity: {
        coverage: Object.fromEntries(
          additionalMetricIds.map((metric) => [
            metric,
            metric === 'inlineComments'
              ? notConnected('Inline review comments are stored only as a count per review.')
              : metric === 'issueComments'
                ? notConnected(notConnectedReasons.issues)
                : coverage,
          ]),
        ),
        comments,
        volumes,
      },
      coverage: Object.fromEntries(
        contributionMetricIds.map((metric) => [
          metric,
          metric === 'issuesAuthored' ? notConnected(notConnectedReasons.issues) : coverage,
        ]),
      ),
      coverageOverrides: dated.status === 'missing' ? [] : all.overrides,
    });
    reports.set(key, source);
    return source;
  }
  const whole: PeriodSelection = {
    kind: 'custom',
    from: activityDatabaseFloor.slice(0, 10),
    through: loaded.asOf.slice(0, 10),
  };
  return {
    kind: 'database',
    asOf: loaded.asOf,
    report: (_scenario, period) => report(period ?? { kind: 'preset', preset: 'this-year' }),
    directory: (): ContributionDirectory => ({ accounts: all.accounts, companies, repositories }),
    timeline: () => ({ contributions: report(whole), availableRanges: availability }),
  };
}

const sources = new WeakMap<LoadedDatabase, ContributionRecordSource>();
/**
 * The source contribution reports read: the activity data (see `activityData`), or the prepared
 * samples.
 */
export function contributionRecords(
  path = process.env.DASHBOARD_ACTIVITY_DATABASE,
): ContributionRecordSource {
  const data = activityData(path);
  if (!data) return sampleContributionRecords;
  const { loaded } = data;
  let source = sources.get(loaded);
  if (!source) sources.set(loaded, (source = databaseContributions(loaded, companyMapping())));
  return source;
}
