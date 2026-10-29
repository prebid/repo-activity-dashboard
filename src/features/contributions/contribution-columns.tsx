import { formatCount } from '@/lib/presentation/format';
import { contributionContextColumns } from '@/lib/presentation/contribution-csv';
import {
  contributorValues,
  companyValues,
  repositoryContributionValues,
} from '@/lib/presentation/contribution-table-values';
import {
  isCoreMetric,
  isReportMetric,
  reportMetricLabel,
  type ReportMetric,
} from '@/models/contribution-metrics';
import type { ContributionSettings } from '@/models/contribution-settings';
import {
  additionalMetricIds,
  additionalMetricDefinitions,
  type AdditionalValues,
} from '@/models/contribution-activity';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { Building2, UserRound, Bot, Cpu, CircleHelp } from 'lucide-react';
import { GitHubAccountLink } from '@/components/github/account-link';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import type { TableQuery } from '@/lib/presentation/table-query';
import type { DataColumn } from '@/components/tables/table-columns';
import {
  contributionMetricIds,
  contributionMetrics,
  type ContributionValues,
  type ContributorMetricRow,
  type CompanyMetricRow,
  type RepositoryContributionRow,
  type ContributionFocus,
  type ContributionContext,
} from '@/models/contributions';
import type { ContributionArea, ContributionSampleScenario } from '@/models/contribution-page';
import {
  contributionHref,
  contributionMetricHref,
} from '@/lib/presentation/contribution-navigation';
import styles from './contributions.module.css';

export type EntityFocus = Exclude<ContributionFocus, { kind: 'overview' }>;
export interface ContributionLinks {
  sample: ContributionSampleScenario;
  settings?: ContributionSettings;
  currentHref: string;
  context?: ContributionContext;
  onMetric?: (
    event: MouseEvent<HTMLAnchorElement>,
    focus: ContributionFocus,
    metric: ReportMetric,
    repositoryId?: string,
  ) => void;
  actorTypes?: ContributionContext['selection']['actorTypes'];
  onAreaFollow?: (event: MouseEvent<HTMLAnchorElement>, area: ContributionArea) => void;
  onFollow?: (event: MouseEvent<HTMLAnchorElement>, focus: EntityFocus) => void;
}
export { actorLabels, metricDescriptions } from '@/models/contribution-metrics';
import { actorLabels } from '@/models/contribution-metrics';
export function EntityLink({
  focus,
  links,
  children,
  className,
  label,
}: {
  focus: EntityFocus;
  links: ContributionLinks;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={contributionHref(
        focus,
        links.sample,
        links.currentHref,
        links.actorTypes,
        links.settings,
      )}
      className={className}
      onClick={(event) => links.onFollow?.(event, focus)}
      aria-label={label}
    >
      {children}
    </Link>
  );
}
export function ContributionMetricLink({
  value,
  metric,
  focus,
  repositoryId,
  links,
}: {
  value: import('@/models/reporting-measurement').Count;
  metric: ReportMetric;
  focus: ContributionFocus;
  repositoryId?: string;
  links: ContributionLinks;
}) {
  const content = <MeasurementValue measurement={value} />;
  if (!links.context || value.value === null) return content;
  return (
    <Link
      prefetch={false}
      className={styles.metricLink}
      href={contributionMetricHref(
        focus.kind === 'overview' ? 'contributors' : focus,
        links.sample,
        links.context,
        metric,
        links.currentHref,
        repositoryId,
      )}
      onClick={(event) => links.onMetric?.(event, focus, metric, repositoryId)}
      aria-label={
        reportMetricLabel(metric) +
        ': ' +
        formatCount(value.value) +
        (value.status === 'partial' ? ' (partial subtotal)' : '') +
        ' — view supporting records'
      }
    >
      {content}
    </Link>
  );
}
function metricCell<T extends { metrics: ContributionValues; additionalMetrics: AdditionalValues }>(
  id: string,
  row: T,
  focus: ContributionFocus,
  links: ContributionLinks,
  repositoryId?: string,
) {
  if (!isReportMetric(id)) return null;
  return (
    <ContributionMetricLink
      value={isCoreMetric(id) ? row.metrics[id] : row.additionalMetrics[id]}
      metric={id}
      focus={focus}
      links={links}
      repositoryId={repositoryId}
    />
  );
}
const actorIcons = { human: UserRound, agent: Cpu, bot: Bot, unknown: CircleHelp };
export function contributorColumns(
  links: ContributionLinks,
  showCompany = true,
): DataColumn<ContributorMetricRow>[] {
  return contributorValues(showCompany).map((column) => {
    if (column.id === 'name')
      return {
        ...column,
        pinned: true,
        hideable: false,
        width: 220,
        cell: (row) => {
          const Icon = actorIcons[row.account.actorType];
          return (
            <div className={styles.identityCell}>
              <span className={styles.avatar} title={actorLabels[row.account.actorType]}>
                <Icon size={17} aria-hidden="true" />
              </span>
              <div className={styles.identity}>
                <EntityLink
                  links={links}
                  focus={{ kind: 'contributor', accountId: row.account.id }}
                  className={styles.identityLink}
                  label={row.account.name + ' — view contribution report'}
                >
                  {row.account.name}
                </EntityLink>
                <GitHubAccountLink
                  login={row.account.login}
                  url={row.account.profileUrl}
                  label={'@' + row.account.login}
                  className={styles.secondary}
                />
              </div>
            </div>
          );
        },
      };
    if (column.id === 'company')
      return {
        ...column,
        width: 130,
        cell: (row) => (
          <EntityLink
            links={links}
            focus={{ kind: 'company', companyId: row.company?.id ?? null }}
            className={styles.companyLink}
          >
            {row.company?.name ?? 'Unmapped company'}
          </EntityLink>
        ),
      };
    if (column.id === 'actorType') return { ...column, width: 110 };
    return {
      ...column,
      width: column.group ? 126 : 110,
      align: 'right',
      cell: (row) =>
        metricCell(column.id, row, { kind: 'contributor', accountId: row.account.id }, links),
    };
  });
}
export function companyColumns(links: ContributionLinks): DataColumn<CompanyMetricRow>[] {
  return companyValues().map((column) =>
    column.id === 'name'
      ? {
          ...column,
          pinned: true,
          hideable: false,
          width: 220,
          cell: (row) => (
            <div className={styles.identityCell}>
              <span className={styles.avatar} aria-hidden="true">
                <Building2 size={17} />
              </span>
              <div className={styles.identity}>
                <EntityLink
                  links={links}
                  focus={{ kind: 'company', companyId: row.company?.id ?? null }}
                  className={styles.identityLink}
                >
                  {row.company?.name ?? 'Unmapped company'}
                </EntityLink>
                <span className={styles.secondary}>
                  {row.company ? 'Current company mapping' : 'Accounts without a company mapping'}
                </span>
              </div>
            </div>
          ),
        }
      : {
          ...column,
          width: column.group ? 126 : 110,
          align: 'right',
          ...(column.id === 'members'
            ? {}
            : {
                cell: (row: CompanyMetricRow) =>
                  metricCell(
                    column.id,
                    row,
                    { kind: 'company', companyId: row.company?.id ?? null },
                    links,
                  ),
              }),
        },
  );
}
export function repositoryContributionColumns(
  links?: ContributionLinks,
): DataColumn<RepositoryContributionRow>[] {
  return repositoryContributionValues().map((column) =>
    column.id === 'name'
      ? {
          ...column,
          pinned: true,
          hideable: false,
          width: 220,
          cell: (row) => (
            <div className={styles.identity}>
              <strong>{row.repository.name}</strong>
              <span className={styles.secondary}>
                Primary branch: {row.repository.primaryBranch}
              </span>
            </div>
          ),
        }
      : {
          ...column,
          width: column.group ? 126 : 110,
          align: 'right',
          cell: (row) =>
            metricCell(
              column.id,
              row,
              links?.context?.focus ?? { kind: 'overview' },
              links ?? { sample: 'reference', currentHref: '/contributors' },
              row.repository.id,
            ),
        },
  );
}
/** Keep the existing CSV action honest when display values are partial or unavailable. */
export function contributionExportColumns<
  T extends { id: string; metrics: ContributionValues; additionalMetrics: AdditionalValues },
>(
  columns: DataColumn<T>[],
  context: ContributionContext,
  query: Pick<TableQuery, 'search' | 'sort' | 'descending'> & { hideZeroMembers?: boolean },
): DataColumn<T>[] {
  return [
    { id: 'rowId', label: 'Row ID', value: (row) => row.id },
    ...columns.map((column) => ({
      ...column,
      label: column.group ? column.group + ' — ' + column.label : column.label,
    })),
    ...additionalMetricIds.flatMap((metric) => [
      {
        id: metric + '.coverage',
        exportWith: metric,
        label:
          additionalMetricDefinitions[metric].group +
          ' — ' +
          additionalMetricDefinitions[metric].label +
          ' coverage',
        value: (row: T) => row.additionalMetrics[metric].status,
      },
      {
        id: metric + '.reason',
        exportWith: metric,
        label:
          additionalMetricDefinitions[metric].group +
          ' — ' +
          additionalMetricDefinitions[metric].label +
          ' coverage detail',
        value: (row: T) => {
          const value = row.additionalMetrics[metric];
          return value.status === 'complete' ? '' : value.reason;
        },
      },
    ]),
    ...contributionMetricIds.flatMap((metric) => [
      {
        id: metric + '.coverage',
        exportWith: metric,
        label: contributionMetrics[metric].label + ' coverage',
        value: (row: T) => row.metrics[metric].status,
      },
      {
        id: metric + '.reason',
        exportWith: metric,
        label: contributionMetrics[metric].label + ' coverage detail',
        value: (row: T) => {
          const value = row.metrics[metric];
          return value.status === 'complete' ? '' : value.reason;
        },
      },
    ]),
    {
      id: 'hideZeroMembers',
      label: 'Hide zero member totals',
      value: () => String(query.hideZeroMembers ?? false),
    },
    ...contributionContextColumns<T>(context, query),
  ];
}

export function contributorExportColumns(
  columns: DataColumn<ContributorMetricRow>[],
  context: ContributionContext,
  query: Pick<TableQuery, 'search' | 'sort' | 'descending'> & { hideZeroMembers?: boolean },
): DataColumn<ContributorMetricRow>[] {
  const identity: DataColumn<ContributorMetricRow>[] = [
    { id: 'login', label: 'GitHub account', value: (row) => row.account.login },
    { id: 'companyId', label: 'Company ID', value: (row) => row.company?.id ?? null },
  ];
  if (!columns.some((column) => column.id === 'company'))
    identity.push({
      id: 'company',
      label: 'Company',
      value: (row) => row.company?.name ?? 'Unmapped company',
    });
  return contributionExportColumns(
    [
      ...columns.map((column) =>
        column.id === 'name'
          ? { ...column, value: (row: ContributorMetricRow) => row.account.name }
          : column.id === 'actorType'
            ? { ...column, value: (row: ContributorMetricRow) => row.account.actorType }
            : column,
      ),
      ...identity,
    ],
    context,
    query,
  );
}
