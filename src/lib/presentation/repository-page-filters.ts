import type { RepositoryPageFilters, RepositoryPageSource } from '@/models/repository-page';
import { requiresNonDraftPr } from './repository-page-rules';
import { ageBandFor, recordEventDate, reviewBucket } from './repository-page-values';
import { inDateRange } from '@/lib/presentation/reporting-period';

type Verdict = boolean | 'unknown';
function category(value: string | null, selected: string[]): Verdict {
  if (!selected.length) return true;
  if (value === null) return selected.includes('unknown') ? true : 'unknown';
  return selected.includes(value);
}
function review(value: number | null, selected: string | undefined): Verdict {
  if (selected === undefined) return true;
  return value === null && selected !== 'unknown' ? 'unknown' : reviewBucket(value) === selected;
}
function coverage(value: boolean | null, selected: string | undefined): Verdict {
  return selected === undefined
    ? true
    : category(value === null ? null : value ? 'yes' : 'no', [selected]);
}

/** OR within a facet, AND across facets. Unknown metadata never proves a known-zero result. */
export function matchesRepositoryPageRow(
  row: RepositoryPageSource['rows'][number],
  filters: RepositoryPageFilters,
  source: RepositoryPageSource,
): Verdict {
  const search = filters.search.toLowerCase();
  const checks: Verdict[] = [
    (row.number + ' ' + row.title + ('draft' in row && row.draft ? ' Draft' : ''))
      .toLowerCase()
      .includes(search),
    !filters.labels.length || row.labels.some((label) => filters.labels.includes(label)),
    !filters.authors.length || filters.authors.includes(row.author.toLowerCase()),
    category(row.authorType, filters.authorTypes),
    !filters.states.length || filters.states.some((state) => state === row.state),
    filters.ageBand === undefined || ageBandFor(row.ageDays) === filters.ageBand,
    filters.eventRange === undefined ||
      inDateRange(recordEventDate(row, source), filters.eventRange),
    !filters.latestActors.length
      ? true
      : row.latestActivity === null
        ? 'unknown'
        : filters.latestActors.includes(row.latestActivity.category),
  ];
  if (filters.kind === 'prs' && 'draft' in row) {
    checks.push(
      filters.draft === 'all' || row.draft === (filters.draft === 'drafts'),
      !filters.branches.length || filters.branches.includes(row.baseBranch),
      !requiresNonDraftPr(filters, source.drilldown.selection) || !row.draft,
      review(row.humanReviewers, filters.reviewers),
      review(row.approvals, filters.approvals),
      coverage(row.agentReviewer, filters.agentReviewer),
      coverage(row.botReviewer, filters.botReviewer),
    );
  }
  if (filters.kind === 'issues' && 'assignees' in row) {
    checks.push(
      !filters.assignees.length
        ? true
        : row.assignees === null
          ? 'unknown'
          : row.assignees.some((account) => filters.assignees.includes(account.toLowerCase())),
      filters.assignment === 'any'
        ? true
        : row.assignees === null
          ? filters.assignment === 'unknown'
            ? true
            : 'unknown'
          : filters.assignment === 'unknown'
            ? false
            : row.assignees.length > 0 === (filters.assignment === 'assigned'),
    );
  }
  return checks.includes(false) ? false : checks.includes('unknown') ? 'unknown' : true;
}
