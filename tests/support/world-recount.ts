import { worldRepository } from '@/mocks/repository-world';
import type { DateRange } from '@/models/reporting-period';
import type { ActivityMetric } from '@/models/repository-overview';

/**
 * Recounts Summary activity from the sample record set by the documented metric definitions,
 * written independently of the sample's own counting helpers so tests can compare the two.
 */
function inside(at: string, range: DateRange) {
  const time = Date.parse(at),
    start = Date.parse(range.start),
    end = Date.parse(range.end);
  return time >= start && (range.endInclusive ? time <= end : time < end);
}
function firstCredits(repositoryId: string, actorType: 'agent' | 'bot', kind: string) {
  return worldRepository(repositoryId).pullRequests.flatMap((pr) => {
    const first = new Map<string, string>();
    for (const review of [...pr.reviews].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)))
      if (review.actorType === actorType && review.kind === kind && !first.has(review.account))
        first.set(review.account, review.at);
    return [...first.values()];
  });
}
export function recountActivity(repositoryId: string, range: DateRange) {
  const repository = worldRepository(repositoryId);
  const opened = repository.pullRequests.filter((row) => inside(row.createdAt, range));
  const merged = repository.pullRequests.filter(
    (row) =>
      row.mergedAt !== null &&
      row.baseBranch === repository.primaryBranch &&
      inside(row.mergedAt, range),
  );
  const issuesOpened = repository.issues.filter((row) => inside(row.createdAt, range));
  const authors = (rows: { author: string }[]) =>
    new Set(rows.map((row) => row.author.toLowerCase())).size;
  const credits = (actorType: 'agent' | 'bot', kind: string) =>
    firstCredits(repositoryId, actorType, kind).filter((at) => inside(at, range)).length;
  const days = merged
    .map((row) => (Date.parse(row.mergedAt!) - Date.parse(row.createdAt)) / 86_400_000)
    .sort((a, b) => a - b);
  const middle = days.length >> 1;
  const counts: Record<ActivityMetric, number> = {
    prsOpened: opened.length,
    prsMerged: merged.length,
    issuesOpened: issuesOpened.length,
    issuesClosed: repository.issues.filter((row) => row.closedAt && inside(row.closedAt, range))
      .length,
    prAuthors: authors(opened),
    issueAuthors: authors(issuesOpened),
    agentFeedbackCredits: credits('agent', 'review'),
    agentApprovalCredits: credits('agent', 'approval'),
    botFeedbackCredits: credits('bot', 'review'),
    botApprovalCredits: credits('bot', 'approval'),
  };
  return {
    counts,
    medianMergeDays: !days.length
      ? null
      : days.length % 2
        ? days[middle]
        : (days[middle - 1] + days[middle]) / 2,
  };
}
