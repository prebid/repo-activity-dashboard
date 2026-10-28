import { recordListKind } from './repository-records';
import {
  repositoryPageFiltersSchema,
  type RepositoryPageSource,
  type RepositoryPageModel,
} from '@/models/repository-page';
import { dateRangeSchema } from '@/models/reporting-period';
import { matchesRepositoryPageRow } from './repository-page-filters';
import { repositoryPageCharts } from './repository-page-charts';
import { subsetCount } from './repository-page-values';

/** Select a presentation cohort without mutating the input, reconstructing history, or paging it. */
export function selectRepositoryPage(
  source: RepositoryPageSource,
  input: unknown = { kind: source.kind },
): RepositoryPageModel {
  if (recordListKind(source.drilldown.selection) !== source.kind)
    throw new Error('Record kind does not match its cohort');
  if ((source.measurement.value ?? 0) !== source.rows.length)
    throw new Error('Page source must contain the full available cohort before pagination');
  const filters = repositoryPageFiltersSchema.parse(input);
  if (filters.kind !== source.kind) throw new Error('Filters do not match the record kind');
  const selection = source.drilldown.selection;
  if (selection.scope === 'current' && filters.eventRange)
    throw new Error('An event range requires period activity');
  if (selection.scope === 'period') {
    dateRangeSchema.parse(selection.range);
    if (
      filters.ageBand !== undefined ||
      (filters.kind === 'prs' &&
        [filters.reviewers, filters.approvals, filters.agentReviewer, filters.botReviewer].some(
          (v) => v !== undefined,
        ))
    )
      throw new Error('Current age and review filters require current scope');
    if (
      filters.eventRange &&
      (filters.eventRange.start < selection.range.start ||
        filters.eventRange.end > selection.range.end ||
        (filters.eventRange.end === selection.range.end &&
          filters.eventRange.endInclusive &&
          !selection.range.endInclusive))
    )
      throw new Error('Activity filter is outside the selected period');
  }
  let unknown = 0;
  const keep = (row: RepositoryPageSource['rows'][number]) => {
    const result = matchesRepositoryPageRow(row, filters, source);
    if (result === 'unknown') unknown++;
    return result === true;
  };
  // Branch before filtering to retain the discriminated record type for view consumers.
  const filtered =
    source.kind === 'prs'
      ? { ...source, rows: source.rows.filter(keep) }
      : { ...source, rows: source.rows.filter(keep) };
  filtered.measurement = subsetCount(source.measurement, filtered.rows.length, unknown);
  return {
    ...filtered,
    filters,
    cohortMeasurement: { ...source.measurement },
    charts: repositoryPageCharts(filtered),
    defaultSort: { sort: 'createdAt', descending: true },
  };
}
