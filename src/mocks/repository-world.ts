import { repositoryCatalog } from '@/config/repositories';
import { reportingBranchSchema } from '@/models/repository-overview';
import type { DateRange } from '@/models/reporting-period';
import type { LatestRecordActivity } from '@/models/repository-page';
import type { LatestActor } from '@/models/repository-records';
import { currentIssueSample, currentPrSample } from './current-records';
import { contributionReferenceStory } from './contributions';
import { issueMetadata, pullRequestActivity } from './record-metadata';
import { sampleAuthorType, sampleBotAuthor } from './repository-accounts';
import { overviewAsOf } from './sample-clock';

/**
 * One dated record set per repository, from which every repository sample view is derived: Summary
 * activity and comparisons, current and period record lists, insights and the repository Timeline.
 * Records are invented; volumes vary display examples and are not estimates of real activity.
 */
const day = 86_400_000;
export const sampleHistoryStart = '2024-01-01T00:00:00.000Z';
const iso = (milliseconds: number) => new Date(milliseconds).toISOString();
const asOfMs = Date.parse(overviewAsOf);
// Divisors of the busiest repository's volume; 'empty' repositories have no records at all.
const sampleSizes: Record<string, number | 'empty'> = {
  'repo-prebidjs': 1,
  'repo-prebidserver': 2,
  'repo-prebidserverjava': 3,
  'repo-prebiddocs': 2,
  'repo-prebidmobileandroid': 4,
  'repo-prebidmobileios': 5,
  'repo-prebid-mobile-ios-sdk': 'empty',
  'repo-prebid-universal-creative': 6,
  'repo-professor-prebid': 8,
  'repo-salesagent': 3,
  'repo-prebid-agent-skills': 7,
  'repo-line-item-manager': 9,
  'repo-go-gdpr': 40,
  'repo-prebid-cache-java': 8,
  'repo-repo-activity-dashboard': 6,
  'repo-openrtb': 40,
  'repo-github-activity-db': 12,
  'repo-prebid-integration-monitor': 'empty',
};
export type WorldScenario = 'reference' | 'partial' | 'missing' | 'empty' | 'mixed';
export type WorldActorType = 'human' | 'agent' | 'bot';
export interface WorldReview {
  account: string;
  actorType: WorldActorType;
  kind: 'review' | 'approval';
  at: string;
  dismissedAt: string | null;
}
interface WorldRecord {
  id: string;
  number: number;
  title: string;
  url: string;
  author: string;
  authorType: WorldActorType | null;
  createdAt: string;
  labels: string[];
  latestActivity: LatestRecordActivity | null;
}
export interface WorldPullRequest extends WorldRecord {
  state: 'Open' | 'Merged' | 'Closed';
  draft: boolean;
  mergedAt: string | null;
  /** When an unmerged PR was closed; it is open at earlier cutoffs only. */
  closedAt: string | null;
  baseBranch: string;
  reviews: WorldReview[];
  humanReviewers: number | null;
  approvals: number | null;
  agentReviewer: boolean | null;
  botReviewer: boolean | null;
  latestActor: LatestActor;
  /** False when the approval history behind the current count cannot be established. */
  approvalHistoryKnown: boolean;
}
export interface WorldIssue extends WorldRecord {
  state: 'Open' | 'Closed';
  closedAt: string | null;
  assignees: string[] | null;
}
export interface WorldRepository {
  id: string;
  slug: string;
  name: string;
  primaryBranch: string;
  availability: DateRange[];
  pullRequests: WorldPullRequest[];
  issues: WorldIssue[];
}

/** Deterministic pseudo-random numbers, so every sample view sees the same invented history. */
function random(seed: string) {
  let state = [...seed].reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619),
    2166136261,
  );
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function lognormalDays(next: () => number, median: number) {
  const gauss = Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return Math.max(0.05, median * Math.exp(0.9 * gauss));
}
function pick<T>(next: () => number, values: readonly T[], skew = 0.8): T {
  const weights = values.map((_, index) => 1 / (index + 1) ** skew);
  let target = next() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < values.length; index++)
    if ((target -= weights[index]) <= 0) return values[index];
  return values[values.length - 1];
}
function authorPool(prefix: string, size: number) {
  return Array.from({ length: size }, (_, index) =>
    index === 2 ? sampleBotAuthor : index === 4 ? 'Sample-Riley' : prefix + (index + 1),
  );
}
const humanReviewerPool = Array.from({ length: 12 }, (_, i) => 'sample-reviewer-' + (i + 1));
const agentPool = ['sample-prebid-agent-a', 'sample-prebid-agent-b'];
const botPool = ['sample-bot-a', 'sample-bot-b'];
function between(next: () => number, from: number, to: number) {
  return iso(from + Math.floor((to - from) * next()));
}
/** Review events consistent with a PR's counts, dated between its creation and `end`. */
function reviewsFor(
  next: () => number,
  createdAt: string,
  end: number,
  counts: {
    humanReviewers: number | null;
    approvals: number | null;
    agent: boolean | null;
    bot: boolean | null;
  },
): WorldReview[] {
  const from = Date.parse(createdAt),
    to = Math.max(from + 1, end);
  const reviews: WorldReview[] = [];
  const people = [...humanReviewerPool].sort(() => next() - 0.5);
  for (let i = 0; i < (counts.humanReviewers ?? 0); i++)
    reviews.push({
      account: people[i],
      actorType: 'human',
      kind: 'review',
      at: between(next, from, to),
      dismissedAt: null,
    });
  for (let i = 0; i < (counts.approvals ?? 0); i++)
    reviews.push({
      account: people[people.length - 1 - i],
      actorType: 'human',
      kind: 'approval',
      at: between(next, from, to),
      dismissedAt: null,
    });
  if (counts.agent)
    reviews.push({
      account: pick(next, agentPool),
      actorType: 'agent',
      kind: next() < 0.5 ? 'review' : 'approval',
      at: between(next, from, to),
      dismissedAt: null,
    });
  if (counts.bot)
    reviews.push({
      account: pick(next, botPool),
      actorType: 'bot',
      kind: 'review',
      at: between(next, from, to),
      dismissedAt: null,
    });
  return reviews.sort((a, b) => a.at.localeCompare(b.at));
}
function url(slug: string, kind: 'pull' | 'issues', number: number) {
  return 'https://github.example/example-fixtures/' + slug + '/' + kind + '/' + number;
}

/** Today's open records, exactly the backlog cohort the Summary and current lists show. */
function openRecords(repo: (typeof repositoryCatalog)[number], next: () => number) {
  const pullRequests = currentPrSample(repo.id).map((row): WorldPullRequest => ({
    ...row,
    authorType: sampleAuthorType(row.author),
    closedAt: null,
    latestActivity: pullRequestActivity(row, overviewAsOf),
    reviews: reviewsFor(next, row.createdAt, asOfMs, {
      humanReviewers: row.humanReviewers,
      approvals: row.approvals,
      agent: row.agentReviewer,
      bot: row.botReviewer,
    }),
    approvalHistoryKnown: true,
  }));
  const issues = currentIssueSample(repo.id).map((row): WorldIssue => ({
    ...row,
    authorType: sampleAuthorType(row.author),
    ...issueMetadata(row, overviewAsOf),
  }));
  return { pullRequests, issues };
}

/** The reference cast's records, ending after the last historical cutoff so today's backlog is unchanged. */
function storyRecords(repositoryId: string, scenario: WorldScenario) {
  const story = contributionReferenceStory();
  const accounts = new Map(story.accounts.map((row) => [row.id, row]));
  const actorType = (id: string) => {
    const type = accounts.get(id)!.actorType;
    return type === 'unknown' ? null : type;
  };
  const endings: Record<number, string> = {
    104: '2026-10-23T12:00:00.000Z',
    105: '2026-10-23T12:00:00.000Z',
    107: '2026-10-24T06:00:00.000Z',
    201: '2026-10-23T12:00:00.000Z',
    202: '2026-09-11T00:00:00.000Z',
    203: '2026-10-23T12:00:00.000Z',
    204: '2026-10-23T12:00:00.000Z',
    205: '2026-10-23T12:00:00.000Z',
    206: '2026-10-23T12:00:00.000Z',
  };
  const pullRequests: WorldPullRequest[] = [],
    issues: WorldIssue[] = [];
  for (const record of story.records.filter((row) => row.repositoryId === repositoryId)) {
    const author = accounts.get(record.authorId!)!;
    const common = {
      id: record.id,
      number: record.number,
      title: record.title,
      url: record.url,
      author: author.login,
      authorType: actorType(author.id),
      createdAt: record.createdAt,
      labels: [record.number % 2 ? 'maintenance' : 'feature'],
      latestActivity: {
        at: record.createdAt,
        account: author.login,
        category: 'contributor' as const,
      },
    };
    if (record.kind === 'issue') {
      // Today's open issues are numbered from 1, so the cast's issues take numbers above them.
      issues.push({
        ...common,
        number: 90_000 + record.number,
        state: 'Closed',
        closedAt: endings[record.number],
        assignees: [],
      });
      continue;
    }
    const reviews = story.credits
      .filter(
        (credit) =>
          credit.recordId === record.id &&
          (credit.metric === 'reviewerContributions' || credit.metric === 'approvalContributions'),
      )
      .map((credit): WorldReview => ({
        account: accounts.get(credit.accountId)!.login,
        actorType: actorType(credit.accountId) ?? 'human',
        kind: credit.metric === 'reviewerContributions' ? 'review' : 'approval',
        at: credit.creditedAt,
        // Alice's approval of PR 107 is dismissed after the 10-22 cutoff, so history and today differ.
        dismissedAt:
          record.number === 107 && credit.metric === 'approvalContributions'
            ? '2026-10-23T00:00:00.000Z'
            : null,
      }));
    const human = (kind: WorldReview['kind']) =>
      reviews.filter((row) => row.actorType === 'human' && row.kind === kind && !row.dismissedAt);
    const merged = record.state === 'Merged';
    pullRequests.push({
      ...common,
      state: merged ? 'Merged' : 'Closed',
      draft: record.draft,
      mergedAt: record.mergedAt,
      closedAt: merged ? null : endings[record.number],
      baseBranch: record.baseBranch,
      reviews,
      humanReviewers: new Set(human('review').map((row) => row.account)).size,
      approvals: human('approval').length,
      agentReviewer: reviews.some((row) => row.actorType === 'agent'),
      botReviewer: reviews.some((row) => row.actorType === 'bot'),
      latestActor: 'contributor',
      // In the partial sample, PR 107's first approval date is unestablished.
      approvalHistoryKnown: !(scenario === 'partial' && record.number === 107),
    });
  }
  return { pullRequests, issues };
}

/** Invented history from the sample start, every record ended before today's clock. */
function historyRecords(
  repo: (typeof repositoryCatalog)[number],
  availability: readonly DateRange[],
  next: () => number,
) {
  const size = sampleSizes[repo.id];
  if (size === 'empty' || size === undefined) return { pullRequests: [], issues: [] };
  const windows = availability.map((range) => [
    Date.parse(range.start),
    Date.parse(range.end) - Number(!range.endInclusive),
  ]);
  const span = windows.reduce((sum, [from, to]) => sum + (to - from), 0);
  const at = () => {
    let target = next() * span;
    for (const [from, to] of windows) {
      if (target < to - from) return from + Math.floor(target);
      target -= to - from;
    }
    return windows[windows.length - 1][1];
  };
  const prAuthors = authorPool('sample-author-', Math.max(4, Math.round(130 / size)));
  const issueAuthors = authorPool('sample-author-', Math.max(4, Math.round(240 / size)));
  const prCount = Math.round(((600 / size) * span) / (365 * day));
  const issueCount = Math.round(((800 / size) * span) / (365 * day));
  const pullRequests = Array.from({ length: prCount }, () => at())
    .sort((a, b) => a - b)
    .map((created, index): WorldPullRequest => {
      const number = 10_001 + index,
        closed = next() < 0.06,
        primary = next() < 0.94;
      let end = created + lognormalDays(next, 6) * day;
      if (end >= asOfMs - 3_600_000) end = created + (asOfMs - created) * (0.2 + 0.7 * next());
      const author = pick(next, prAuthors);
      const reviewers = [0, 1, 1, 2, 2, 3][Math.floor(next() * 6)],
        approvals = Math.min(reviewers, [0, 1, 1, 2][Math.floor(next() * 4)]);
      const createdAt = iso(created),
        endAt = iso(end);
      const reviews = reviewsFor(next, createdAt, end, {
        humanReviewers: reviewers,
        approvals,
        agent: next() < 0.35,
        bot: next() < 0.25,
      });
      const authorType = sampleAuthorType(author);
      return {
        id: repo.id + '-pr-' + number,
        number,
        title: 'Sample PR ' + number + ': Update integration behavior',
        url: url(repo.slug, 'pull', number),
        author,
        authorType: authorType,
        createdAt,
        labels: [next() < 0.3 ? 'maintenance' : 'enhancement'],
        latestActivity: { at: endAt, account: author, category: 'contributor' },
        state: closed ? 'Closed' : 'Merged',
        draft: false,
        mergedAt: closed ? null : endAt,
        closedAt: closed ? endAt : null,
        baseBranch: primary ? repo.primaryBranch : 'release',
        reviews,
        humanReviewers: new Set(
          reviews
            .filter((row) => row.actorType === 'human' && row.kind === 'review')
            .map((row) => row.account),
        ).size,
        approvals: reviews.filter((row) => row.actorType === 'human' && row.kind === 'approval')
          .length,
        agentReviewer: reviews.some((row) => row.actorType === 'agent'),
        botReviewer: reviews.some((row) => row.actorType === 'bot'),
        latestActor: 'contributor',
        approvalHistoryKnown: true,
      };
    });
  const issues = Array.from({ length: issueCount }, () => at())
    .sort((a, b) => a - b)
    .map((created, index): WorldIssue => {
      const number = 60_001 + index;
      let end = created + lognormalDays(next, 10) * day;
      if (end >= asOfMs - 3_600_000) end = created + (asOfMs - created) * (0.2 + 0.7 * next());
      const author = pick(next, issueAuthors);
      const authorType = sampleAuthorType(author);
      const row = { author, createdAt: iso(created), closedAt: iso(end), number };
      return {
        ...row,
        id: repo.id + '-issue-' + number,
        title: 'Sample issue ' + number + ': Improve documentation',
        url: url(repo.slug, 'issues', number),
        authorType: authorType,
        labels: [next() < 0.4 ? 'bug' : 'documentation'],
        state: 'Closed',
        ...issueMetadata(row, overviewAsOf),
      };
    });
  return { pullRequests, issues };
}

const fullHistory: DateRange = { start: sampleHistoryStart, end: overviewAsOf, endInclusive: true };
/** Repositories whose prepared history differs from the full sample window. */
function referenceAvailability(id: string): DateRange[] {
  if (id === 'repo-github-activity-db')
    return [{ start: '2026-10-01T00:00:00.000Z', end: overviewAsOf, endInclusive: true }];
  if (id === 'repo-prebid-cache-java')
    return [
      { start: sampleHistoryStart, end: '2026-09-01T00:00:00.000Z', endInclusive: false },
      { start: '2026-10-01T00:00:00.000Z', end: overviewAsOf, endInclusive: true },
    ];
  return [fullHistory];
}
function cut(ranges: readonly DateRange[], from: string, to: string): DateRange[] {
  return ranges.flatMap((range) => {
    const parts: DateRange[] = [];
    if (range.start < from)
      parts.push({
        start: range.start,
        end: range.end < from ? range.end : from,
        endInclusive: range.end < from && range.endInclusive,
      });
    if (range.end > to || (range.end === to && range.endInclusive))
      parts.push({
        start: range.start > to ? range.start : to,
        end: range.end,
        endInclusive: range.endInclusive,
      });
    return parts;
  });
}

const worlds = new Map<string, Map<string, WorldRepository>>();
/**
 * The prepared record set for a sample scenario. `gap` removes February 2026 from every
 * repository's prepared history while keeping its records, as a temporary outage would.
 */
export function repositoryWorld(scenario: WorldScenario = 'reference', gap = false) {
  const key = scenario + ':' + gap;
  const cached = worlds.get(key);
  if (cached) return cached;
  const result = new Map<string, WorldRepository>();
  for (const repo of repositoryCatalog.filter((row) => row.enabled)) {
    const next = random(repo.id);
    const history = referenceAvailability(repo.id);
    const open = openRecords(repo, next),
      story = storyRecords(repo.id, scenario),
      past = historyRecords(repo, history, next);
    let availability = history;
    if (gap)
      availability = cut(availability, '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z');
    if (scenario === 'missing') availability = [];
    if (scenario === 'mixed' && repo.id === 'repo-prebidserver')
      availability = cut(availability, sampleHistoryStart, '2026-02-01T00:00:00.000Z');
    const empty =
      scenario === 'empty' || (scenario === 'mixed' && repo.id === 'repo-prebidserverjava');
    if (scenario === 'mixed' && repo.id === 'repo-prebidserverjava') availability = [];
    const byCreated = <T extends { createdAt: string; number: number }>(rows: T[]) =>
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number);
    result.set(repo.id, {
      id: repo.id,
      slug: repo.slug,
      name: repo.displayName,
      primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
      availability,
      pullRequests: empty
        ? []
        : byCreated([...past.pullRequests, ...story.pullRequests, ...open.pullRequests]),
      issues: empty ? [] : byCreated([...past.issues, ...story.issues, ...open.issues]),
    });
  }
  worlds.set(key, result);
  return result;
}
export function worldRepository(id: string, scenario: WorldScenario = 'reference', gap = false) {
  const repository = repositoryWorld(scenario, gap).get(id);
  if (!repository) throw Error('Unknown sample repository');
  return repository;
}
/** A PR's review state at a cutoff, from the dated reviews before it. Unknown stays unknown. */
export function reviewStateAt(row: WorldPullRequest, cutoff: string) {
  const before = row.reviews.filter((review) => review.at < cutoff);
  const humans = (kind: WorldReview['kind']) =>
    before.filter(
      (review) =>
        review.actorType === 'human' &&
        review.kind === kind &&
        (review.dismissedAt === null || review.dismissedAt >= cutoff),
    );
  return {
    humanReviewers:
      row.humanReviewers === null
        ? null
        : new Set(humans('review').map((review) => review.account)).size,
    approvals:
      row.approvals === null || !row.approvalHistoryKnown ? null : humans('approval').length,
    agentReviewer:
      row.agentReviewer === null ? null : before.some((review) => review.actorType === 'agent'),
    botReviewer:
      row.botReviewer === null ? null : before.some((review) => review.actorType === 'bot'),
  };
}
/** When a record stopped being open: merged, closed, or still open. */
export function endedAt(row: WorldPullRequest | WorldIssue): string | null {
  return 'mergedAt' in row ? (row.mergedAt ?? row.closedAt) : row.closedAt;
}
export { fullHistory as sampleHistory };
