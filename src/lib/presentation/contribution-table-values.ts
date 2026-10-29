import type { SelectableColumn } from '@/models/column-selection';
import {
  reportMetricIds,
  isCoreMetric,
  actorLabels,
  reportMetricDescription,
  contributionSelectionGroups,
} from '@/models/contribution-metrics';
import {
  contributionMetrics,
  type ContributionValues,
  type ContributorMetricRow,
  type CompanyMetricRow,
  type RepositoryContributionRow,
} from '@/models/contributions';
import { additionalMetricDefinitions, type AdditionalValues } from '@/models/contribution-activity';
import { compareValues } from './format';
import type { TableQuery } from './table-query';
export interface ValueColumn<T> extends Omit<SelectableColumn, 'required'> {
  value: (row: T) => string | number | null;
  sortValue?: (row: T) => string | number | null;
}
export function contributionMetricValues<
  T extends { metrics: ContributionValues; additionalMetrics: AdditionalValues },
>(): ValueColumn<T>[] {
  return reportMetricIds.map((metric) => ({
    id: metric,
    label: isCoreMetric(metric)
      ? contributionMetrics[metric].label
      : additionalMetricDefinitions[metric].label,
    group: isCoreMetric(metric) ? undefined : additionalMetricDefinitions[metric].group,
    description: reportMetricDescription(metric),
    selectionGroup: isCoreMetric(metric)
      ? contributionSelectionGroups[metric]
      : additionalMetricDefinitions[metric].group,
    selectionSection: isCoreMetric(metric)
      ? undefined
      : additionalMetricDefinitions[metric].selectionSection,
    value: (row) =>
      (isCoreMetric(metric) ? row.metrics[metric] : row.additionalMetrics[metric]).value,
    sortValue: (row) => {
      const value = isCoreMetric(metric) ? row.metrics[metric] : row.additionalMetrics[metric];
      return value.status === 'complete' ? value.value : null;
    },
  }));
}
export function contributorValues(showCompany = true): ValueColumn<ContributorMetricRow>[] {
  return [
    {
      id: 'name',
      selectionGroup: 'Identity',
      label: 'Contributor',
      value: (row) => row.account.name + ' ' + row.account.login,
      sortValue: (row) => row.account.name,
    },
    {
      id: 'actorType',
      selectionGroup: 'Identity',
      label: 'Account type',
      description:
        'Human, mapped Prebid agent, other GitHub bot, or unclassified account. Hiding the column does not clear the account-type filter.',
      value: (row) => actorLabels[row.account.actorType],
    },
    ...(showCompany
      ? [
          {
            id: 'company',
            selectionGroup: 'Identity',
            label: 'Company',
            description: 'Current company mapping; historical employment is not inferred.',
            value: (row: ContributorMetricRow) => row.company?.name ?? 'Unmapped company',
          },
        ]
      : []),
    ...contributionMetricValues<ContributorMetricRow>(),
  ];
}
export function companyValues(): ValueColumn<CompanyMetricRow>[] {
  return [
    {
      id: 'name',
      selectionGroup: 'Identity',
      label: 'Company',
      value: (row) => row.company?.name ?? 'Unmapped company',
    },
    {
      id: 'members',
      selectionGroup: 'Identity',
      label: 'Included accounts',
      description:
        'Selected member accounts, including known zero activity. This is not a count of PR authors or PRs.',
      value: (row) => row.memberCount,
    },
    ...contributionMetricValues<CompanyMetricRow>(),
  ];
}
export function repositoryContributionValues(): ValueColumn<RepositoryContributionRow>[] {
  return [
    {
      id: 'name',
      selectionGroup: 'Identity',
      label: 'Repository',
      value: (row) => row.repository.name,
    },
    ...contributionMetricValues<RepositoryContributionRow>(),
  ];
}
/** Same values and stable null-last ordering as the visible table, before pagination. */
export function contributionTableRows<T>(
  rows: T[],
  columns: ValueColumn<T>[],
  query: Pick<TableQuery, 'search' | 'sort' | 'descending'>,
  searchable = true,
): T[] {
  const sort = columns.find((column) => column.id === query.sort);
  return rows
    .filter(
      (row) =>
        !searchable ||
        columns.some((column) =>
          String(column.value(row) ?? '')
            .toLocaleLowerCase('en')
            .includes(query.search.toLocaleLowerCase('en')),
        ),
    )
    .sort((a, b) =>
      sort
        ? compareValues(
            (sort.sortValue ?? sort.value)(a),
            (sort.sortValue ?? sort.value)(b),
            query.descending ? 'desc' : 'asc',
          )
        : 0,
    );
}

/** Only complete zero values are hidden; unknown, partial and not-applicable values stay visible. */
export function isKnownZeroContribution(
  row: Pick<ContributorMetricRow, 'metrics' | 'additionalMetrics'>,
): boolean {
  return Object.values({ ...row.metrics, ...row.additionalMetrics }).every(
    (value) => value.status === 'complete' && value.value === 0,
  );
}
