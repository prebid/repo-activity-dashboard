import type { RepositoryPageFilters } from '@/models/repository-page';
import type { RecordSelection } from '@/models/repository-records';

export const currentReviewFilterKeys = [
  'reviewers',
  'approvals',
  'agentReviewer',
  'botReviewer',
] as const;
export function usesReviewFilters(filters: RepositoryPageFilters): boolean {
  return (
    filters.kind === 'prs' && currentReviewFilterKeys.some((key) => filters[key] !== undefined)
  );
}
/** Current latest-actor metrics share the summary's non-draft population; period/issue metadata remains usable. */
export function requiresNonDraftPr(
  filters: RepositoryPageFilters,
  selection: RecordSelection,
): boolean {
  return (
    filters.kind === 'prs' &&
    (usesReviewFilters(filters) ||
      (selection.scope === 'current' && filters.latestActors.length > 0))
  );
}
export function withoutCurrentReviewFilters(filters: RepositoryPageFilters): RepositoryPageFilters {
  if (filters.kind === 'issues') return { ...filters };
  const next = { ...filters };
  for (const key of currentReviewFilterKeys) next[key] = undefined;
  return next;
}
/** One compatibility rule for throwing selectors and recoverable URL parsing. */
export function repositoryFilterError(
  filters: RepositoryPageFilters,
  selection: RecordSelection,
): string | undefined {
  if (selection.scope === 'current')
    return filters.eventRange ? 'An event range requires period activity' : undefined;
  if (filters.ageBand !== undefined || usesReviewFilters(filters))
    return 'Current age and review filters require current scope';
  if (
    filters.eventRange &&
    (filters.eventRange.start < selection.range.start ||
      filters.eventRange.end > selection.range.end ||
      (filters.eventRange.end === selection.range.end &&
        filters.eventRange.endInclusive &&
        !selection.range.endInclusive))
  )
    return 'Activity filter is outside the selected period';
}
