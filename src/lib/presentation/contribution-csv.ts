import { measurementSortNote } from './measurement-order';
import type { ContributionContext } from '@/models/contributions';
import { type TableQuery } from '@/models/table-query';
import type { ValueColumn } from './contribution-table-values';
import type { ContributionLens } from '@/models/contribution-lens';

/** The lens an export was taken in and, for an overview's table, the accounts it lists. */
export interface ContributionCsvLens {
  lens: ContributionLens;
  /** Overview exports: reviewer evidence only, or every account with activity. */
  listed?: 'reviewers' | 'all';
}
const listedLabels = {
  reviewers: 'Reviewer activity',
  all: 'All accounts with activity',
} as const;
export function contributionContextColumns<T>(
  context: ContributionContext,
  query: Pick<TableQuery, 'search' | 'sort' | 'descending'>,
  report: ContributionCsvLens = { lens: 'contributors' },
): ValueColumn<T>[] {
  return [
    { id: 'sortPolicy', label: 'Metric ordering', value: () => measurementSortNote },
    { id: 'source', label: 'Data source', value: () => context.source },
    { id: 'scenario', label: 'Sample scenario', value: () => context.scenarioId },
    { id: 'periodStart', label: 'Period start (UTC)', value: () => context.range.start },
    { id: 'periodEnd', label: 'Period end (UTC)', value: () => context.range.end },
    { id: 'endInclusive', label: 'End inclusive', value: () => String(context.range.endInclusive) },
    { id: 'asOf', label: 'Snapshot (UTC)', value: () => context.asOf },
    { id: 'attribution', label: 'Company attribution', value: () => context.companyAttribution },
    { id: 'scope', label: 'Report focus', value: () => JSON.stringify(context.focus) },
    { id: 'selection', label: 'Report selection', value: () => JSON.stringify(context.selection) },
    { id: 'lens', label: 'Report lens', value: () => report.lens },
    ...(report.listed
      ? [{ id: 'listed', label: 'Listed accounts', value: () => listedLabels[report.listed!] }]
      : []),
    { id: 'tableSearch', label: 'Table search', value: () => query.search },
    { id: 'tableSort', label: 'Sorted by', value: () => query.sort },
    {
      id: 'tableDirection',
      label: 'Sort direction',
      value: () => (query.descending ? 'desc' : 'asc'),
    },
  ];
}
