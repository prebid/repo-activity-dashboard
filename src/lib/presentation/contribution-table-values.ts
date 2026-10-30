import { accountTypeLabels } from '@/models/github-account';
import type { SelectableColumn } from '@/models/column-selection';
import {
  reportMetricIds,
  isCoreMetric,
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
import type { TableValueColumn } from '@/models/table-values';
import { measurementSortGroup, measurementSortNote } from './measurement-order';
export interface ValueColumn<T> extends Omit<SelectableColumn, 'required'>, TableValueColumn<T> {}
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
    sortGroup: (row) =>
      measurementSortGroup(
        isCoreMetric(metric) ? row.metrics[metric] : row.additionalMetrics[metric],
      ),
    sortNote: measurementSortNote,
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
      value: (row) => accountTypeLabels[row.account.actorType],
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
/** Only complete zero values are hidden; unknown, partial and not-applicable values stay visible. */
export function isKnownZeroContribution(
  row: Pick<ContributorMetricRow, 'metrics' | 'additionalMetrics'>,
): boolean {
  return Object.values({ ...row.metrics, ...row.additionalMetrics }).every(
    (value) => value.status === 'complete' && value.value === 0,
  );
}
