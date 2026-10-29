import type { ContributionContext } from '@/models/contributions';
import type { TableQuery } from './table-query';
import type { ValueColumn } from './contribution-table-values';
export function contributionContextColumns<T>(
  context: ContributionContext,
  query: Pick<TableQuery, 'search' | 'sort' | 'descending'>,
): ValueColumn<T>[] {
  return [
    { id: 'source', label: 'Data source', value: () => context.source },
    { id: 'scenario', label: 'Sample scenario', value: () => context.scenarioId },
    { id: 'periodStart', label: 'Period start (UTC)', value: () => context.range.start },
    { id: 'periodEnd', label: 'Period end (UTC)', value: () => context.range.end },
    { id: 'endInclusive', label: 'End inclusive', value: () => String(context.range.endInclusive) },
    { id: 'asOf', label: 'Snapshot (UTC)', value: () => context.asOf },
    { id: 'attribution', label: 'Company attribution', value: () => context.companyAttribution },
    { id: 'scope', label: 'Report focus', value: () => JSON.stringify(context.focus) },
    { id: 'selection', label: 'Report selection', value: () => JSON.stringify(context.selection) },
    { id: 'tableSearch', label: 'Table search', value: () => query.search },
    { id: 'tableSort', label: 'Sorted by', value: () => query.sort },
    {
      id: 'tableDirection',
      label: 'Sort direction',
      value: () => (query.descending ? 'desc' : 'asc'),
    },
  ];
}
