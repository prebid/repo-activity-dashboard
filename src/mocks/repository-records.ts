import { repositoryCatalog } from '@/config/repositories';
import type { Count, OverviewRepository, RepositoryBacklog } from '@/models/repository-overview';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type {
  RecordSelection,
  RepositoryRecordList,
  RepositoryPullRequest,
  RepositoryIssue,
  LatestActor,
} from '@/models/repository-records';
import { agingThresholds } from '@/models/repository-overview';
import { matchesCurrentPr, recordListKind } from '@/lib/presentation/repository-records';
import { overviewBacklogs } from './overview-backlog';
import { overviewAsOf } from './repository-overview';
import { preparedPeriodSample } from './overview-period-sample';

const day = 86_400_000;
const instant = (milliseconds: number) => new Date(milliseconds).toISOString();
const ago = (days: number) => instant(Date.parse(overviewAsOf) - days * day);
function known(count: Count): number {
  if (count.value === null) throw new Error('Missing required sample count');
  return count.value;
}
function bucket(index: number, counts: Count[]): number | null {
  if (counts.some((count) => count.status !== 'complete')) return null;
  let boundary = 0;
  return counts.findIndex((count) => index < (boundary += known(count)));
}
function ageAt(rank: number, backlog: RepositoryBacklog): number {
  const total = known(backlog.counts.nonDraftPrs);
  let lower = 0;
  for (const threshold of agingThresholds) {
    if (rank < total - known(backlog.agedPrs[threshold])) return lower + 1;
    lower = threshold;
  }
  return lower + 1;
}
function coverage(index: number, count: Count): boolean | null {
  return count.value !== null && index < count.value
    ? true
    : count.status === 'complete'
      ? false
      : null;
}
function repository(id: string) {
  const repo = repositoryCatalog.find((entry) => entry.id === id && entry.enabled);
  if (!repo) throw new Error('Unknown sample repository');
  return repo;
}
const latest: LatestActor[] = [
  'agent',
  'bot',
  'prebid-reviewer',
  'contributor',
  'other-human',
  'unknown',
];
export const sampleBotAuthor = 'sample-author-3[bot]';
function sampleAuthor(index: number, count: number, heavyCount = 0): string {
  let ordinal: number;
  if (!heavyCount) ordinal = (index % count) + 1;
  else if (index < heavyCount * 2 && index % 2 === 0) ordinal = 2;
  else {
    const otherIndex = index < heavyCount * 2 ? Math.floor(index / 2) : index - heavyCount;
    const otherOrdinal = (otherIndex % (count - 1)) + 1;
    ordinal = otherOrdinal >= 2 ? otherOrdinal + 1 : otherOrdinal;
  }
  return ordinal === 3 ? sampleBotAuthor : 'sample-author-' + ordinal;
}

/** Expand only requested sample lists. Counts are prepared values, never fetched reporting history. */
export function currentPrSample(repositoryId: string): RepositoryPullRequest[] {
  const repo = repository(repositoryId);
  const backlog = overviewBacklogs[repo.id],
    c = backlog.counts;
  const drafts = known(c.draftPrs),
    nonDrafts = known(c.nonDraftPrs);
  return Array.from({ length: drafts + nonDrafts }, (_, index): RepositoryPullRequest => {
    const number = index + 1,
      draft = index < drafts,
      position = index - drafts;
    const ageDays = draft ? 1 + (index % 20) : ageAt(nonDrafts - position - 1, backlog);
    const actor = draft
      ? 3
      : bucket(position, [
          c.lastAgent,
          c.lastBot,
          c.lastPrebidReviewer,
          c.lastContributor,
          c.lastOtherHuman,
          c.lastUnknown,
        ]);
    return {
      id: repo.id + '-pr-' + number,
      number: 1000 + number,
      title:
        'Sample PR ' +
        number +
        ': ' +
        (number % 3 === 0
          ? 'Improve adapter configuration and validation'
          : 'Update integration behavior'),
      author: number % 2 === 0 ? 'sample-alice' : 'sample-bob',
      draft,
      humanReviewers: draft
        ? 0
        : bucket(position, [
            c.humanReviewers0,
            c.humanReviewers1,
            c.humanReviewers2,
            c.humanReviewersMoreThan2,
          ]),
      approvals: draft
        ? 0
        : bucket(position, [
            c.humanApprovals0,
            c.humanApprovals1,
            c.humanApprovals2,
            c.humanApprovalsMoreThan2,
          ]),
      ageDays,
      url: 'https://github.example/example-fixtures/' + repo.slug + '/pull/' + (1000 + number),
      state: 'Open',
      labels: [number % 3 === 0 ? 'maintenance' : 'enhancement'],
      createdAt: ago(ageDays),
      mergedAt: null,
      baseBranch: repo.primaryBranch,
      agentReviewer: draft ? false : coverage(position, c.agentFeedbackPrs),
      botReviewer: draft ? false : coverage(position, c.botFeedbackPrs),
      latestActor: actor === null ? 'unknown' : latest[actor],
    };
  }).sort((a, b) => a.ageDays - b.ageDays || b.number - a.number);
}
export function currentIssueSample(repositoryId: string): RepositoryIssue[] {
  const repo = repository(repositoryId),
    count = known(overviewBacklogs[repo.id].counts.openIssues);
  return Array.from({ length: count }, (_, index): RepositoryIssue => ({
    id: repo.id + '-issue-' + (index + 1),
    number: index + 1,
    title:
      index === 0
        ? 'Oldest sample issue: keyboard navigation'
        : 'Sample issue ' + (index + 1) + ': Improve documentation',
    author: index % 2 === 0 ? 'sample-alice' : 'sample-bob',
    ageDays: count - index,
    url: 'https://github.example/example-fixtures/' + repo.slug + '/issues/' + (index + 1),
    state: 'Open',
    labels: ['documentation'],
    createdAt: ago(count - index),
    closedAt: null,
  })).reverse();
}
export function repositorySample(repositoryId: string) {
  return { prs: currentPrSample(repositoryId), issues: currentIssueSample(repositoryId) };
}

export function repositoryRecordSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: RecordSelection },
): RepositoryRecordList {
  const selection = drilldown.selection;
  const context = { repository: repo, asOf: overviewAsOf, drilldown };
  if (selection.scope === 'current') {
    const backlog = overviewBacklogs[repo.id];
    const measurement =
      selection.metric === 'agedPrs'
        ? backlog.agedPrs[selection.ageDays]
        : backlog.counts[selection.metric];
    return recordListKind(selection) === 'issues'
      ? {
          ...context,
          measurement,
          kind: 'issues',
          rows: measurement.value === null ? [] : currentIssueSample(repo.id),
        }
      : {
          ...context,
          measurement,
          kind: 'prs',
          rows:
            measurement.value === null
              ? []
              : currentPrSample(repo.id).filter((row) => matchesCurrentPr(row, selection)),
        };
  }
  const period = preparedPeriodSample(repo.id, selection.range);
  const periodIndex = period?.index;
  const prepared = period?.activity;
  const measurement: Count = prepared?.counts[selection.metric] ?? {
    status: 'missing',
    value: null,
    reason: 'No prepared sample records for this date range.',
  };
  if (!prepared || periodIndex === undefined || measurement.value === null)
    return recordListKind(selection) === 'issues'
      ? { ...context, measurement, kind: 'issues', rows: [] }
      : { ...context, measurement, kind: 'prs', rows: [] };

  // Each supported range is a prepared example, not a simulator of cross-period event history.
  const start = Date.parse(selection.range.start),
    end = Date.parse(selection.range.end) - Number(!selection.range.endInclusive);
  const eventTime = (index: number, count: number, offset: number) =>
    instant(start + Math.floor((end - start) * (offset + (0.4 * index) / Math.max(count, 1))));
  const prefix = repo.id + '-period-' + periodIndex;
  const largeAuthorSample =
    repo.id === 'repo-prebidjs' &&
    period?.selection.kind === 'preset' &&
    period.selection.preset === 'this-year';
  const base = (periodIndex + 1) * 100_000;
  if (recordListKind(selection) === 'prs') {
    const opened = known(prepared.counts.prsOpened),
      merged = known(prepared.counts.prsMerged);
    const medianDuration = (prepared.mergeDuration.days.value ?? 0) * day;
    // Symmetric whole-millisecond offsets preserve the supplied median for odd and even counts.
    const step = Math.floor(medianDuration / Math.max(2 * merged, 1));
    const durationAt = (index: number) => medianDuration + (2 * index - (merged - 1)) * step;
    const overlap =
      durationAt(Math.max(merged - 1, 0)) <= end - start
        ? Math.min(opened, Math.floor(merged / 2))
        : 0;
    const authorCount = Math.max(1, known(prepared.counts.prAuthors));
    function pr(index: number, createdAt: string, mergedAt: string | null): RepositoryPullRequest {
      const number = base + index + 1,
        isMerged = mergedAt !== null;
      return {
        id: prefix + '-pr-' + number,
        number,
        title: 'Sample PR ' + number + ': Update integration behavior',
        author: sampleAuthor(index, authorCount, largeAuthorSample ? 240 : 0),
        state: isMerged ? 'Merged' : index % 5 === 0 ? 'Closed' : 'Open',
        draft: !isMerged && index % 5 !== 0 && index % 7 === 0,
        humanReviewers: null,
        approvals: null,
        ageDays: Math.floor((Date.parse(overviewAsOf) - Date.parse(createdAt)) / day),
        url: 'https://github.example/example-fixtures/' + repo.slug + '/pull/' + number,
        labels: ['maintenance'],
        createdAt,
        mergedAt,
        baseBranch: repo.primaryBranch,
        agentReviewer: null,
        botReviewer: null,
        latestActor: 'unknown',
      };
    }
    const openedRows = Array.from({ length: opened }, (_, i) => {
      if (i >= overlap) return pr(i, eventTime(i, opened, 0), null);
      const duration = durationAt(i);
      const created = start + Math.floor(((end - start - duration) * i) / Math.max(overlap, 1));
      return pr(i, instant(created), instant(created + duration));
    });
    const rows =
      selection.metric === 'prsOpened'
        ? openedRows
        : [
            ...openedRows.slice(0, overlap),
            ...Array.from({ length: merged - overlap }, (_, i) => {
              const duration = durationAt(i + overlap);
              const mergedAt =
                start +
                Math.floor(
                  (Math.min(Math.max(duration - 1, 0), end - start) * i) /
                    Math.max(merged - overlap, 1),
                );
              return pr(opened + i, instant(mergedAt - duration), instant(mergedAt));
            }),
          ];
    return {
      ...context,
      measurement,
      kind: 'prs',
      rows: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number),
    };
  }
  const opened = known(prepared.counts.issuesOpened),
    closed = known(prepared.counts.issuesClosed);
  const overlap = Math.min(opened, Math.floor(closed / 2));
  const authorCount = Math.max(1, known(prepared.counts.issueAuthors));
  function issue(index: number, createdAt: string, closedAt: string | null): RepositoryIssue {
    const number = base + 50_000 + index + 1;
    return {
      id: prefix + '-issue-' + number,
      number,
      title: 'Sample issue ' + number + ': Improve documentation',
      author: sampleAuthor(index, authorCount, largeAuthorSample ? 350 : 0),
      state: closedAt === null ? 'Open' : 'Closed',
      labels: ['documentation'],
      createdAt,
      closedAt,
      ageDays: Math.floor((Date.parse(overviewAsOf) - Date.parse(createdAt)) / day),
      url: 'https://github.example/example-fixtures/' + repo.slug + '/issues/' + number,
    };
  }
  const openedRows = Array.from({ length: opened }, (_, i) =>
    issue(i, eventTime(i, opened, 0), i < overlap ? eventTime(i, closed, 0.5) : null),
  );
  const rows =
    selection.metric === 'issuesOpened'
      ? openedRows
      : [
          ...openedRows.slice(0, overlap),
          ...Array.from({ length: closed - overlap }, (_, i) =>
            issue(opened + i, instant(start - (i + 1) * day), eventTime(i + overlap, closed, 0.5)),
          ),
        ];
  return {
    ...context,
    measurement,
    kind: 'issues',
    rows: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number),
  };
}
