import { formatCount } from '@/lib/presentation/format';
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
import { type AdditionalValues } from '@/models/contribution-activity';
import Link from 'next/link';
import type { MouseEvent, ComponentProps } from 'react';
import { GitHubAccountLink } from '@/components/github/account-link';
import { AccountTypeLabel, Avatar, type AvatarSize } from '@/components/github/avatar';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import drillable from '@/components/metrics/drillable-number.module.css';
import type { DataColumn } from '@/components/tables/table-columns';
import {
  type ContributionMetric,
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
import { contributionLinkLimitMessage } from '@/lib/presentation/contribution-return';

export type EntityFocus = Exclude<ContributionFocus, { kind: 'overview' }>;
export interface ContributionLinks {
  sample: ContributionSampleScenario;
  settings?: ContributionSettings;
  currentHref: string;
  timelineHref?: string | null;
  onTimeline?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** The tab whose handler-started navigation is pending: an area, or `timeline` for Over time. */
  pendingTarget?: string | null;
  context?: ContributionContext;
  onMetric?: (
    event: MouseEvent<HTMLAnchorElement>,
    focus: ContributionFocus,
    metric: ReportMetric,
    repositoryId?: string,
  ) => void;
  onAreaFollow?: (event: MouseEvent<HTMLAnchorElement>, area: ContributionArea) => void;
  onFollow?: (event: MouseEvent<HTMLAnchorElement>, focus: EntityFocus) => void;
}

export function ContributionNavigationLink({
  href,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { href: string | null }) {
  return href ? (
    <Link prefetch={false} href={href} {...props}>
      {children}
    </Link>
  ) : (
    <span className={props.className} title={contributionLinkLimitMessage}>
      {children}
    </span>
  );
}
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
  const href = contributionHref(focus, links.sample, links.currentHref, links.settings);
  return (
    <ContributionNavigationLink
      prefetch={false}
      href={href}
      className={className}
      onClick={(event) => links.onFollow?.(event, focus)}
      aria-label={label}
    >
      {children}
    </ContributionNavigationLink>
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
  const href = contributionMetricHref(
    focus.kind === 'overview' ? 'contributors' : focus,
    links.sample,
    links.context,
    metric,
    links.currentHref,
    repositoryId,
  );
  return (
    <ContributionNavigationLink
      prefetch={false}
      // A value past the link limit opens nothing, so it does not look drillable.
      className={href === null ? undefined : drillable.link}
      href={href}
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
    </ContributionNavigationLink>
  );
}
/**
 * Headings drawn over the core metrics on screen only, so metric names, the Columns menu, the CSV
 * dialog and CSV headers keep the plain labels.
 */
const coreMetricHeadings: Record<ContributionMetric, string> = {
  prsAuthored: 'Authoring',
  authoredPrsMerged: 'Authoring',
  reviewerContributions: 'Reviewing',
  approvalContributions: 'Reviewing',
  mergesPerformed: 'Reviewing',
  issuesAuthored: 'Issues',
};
/**
 * Every number column declares one width, so at the table's minimum width their headers wrap
 * alike; above it the table shares the surplus among them.
 */
function numberColumn(id: string): Pick<DataColumn<unknown>, 'width' | 'align' | 'displayGroup'> {
  return {
    width: 126,
    align: 'right',
    displayGroup: isReportMetric(id) && isCoreMetric(id) ? coreMetricHeadings[id] : undefined,
  };
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
/** A company row's identity: a monogram, or the dashed tile of the unmapped bucket. */
export function CompanyAvatar({
  company,
  size,
}: {
  company: { name: string } | null;
  size: AvatarSize;
}) {
  return company ? (
    <Avatar kind="company" name={company.name} size={size} />
  ) : (
    <Avatar kind="unmapped-company" size={size} />
  );
}
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
        cell: (row) => (
          <div className={styles.identityCell}>
            <Avatar
              kind="person"
              name={row.account.name}
              accountType={row.account.actorType}
              size={32}
            />
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
              <AccountTypeLabel accountType={row.account.actorType} />
            </div>
          </div>
        ),
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
      ...numberColumn(column.id),
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
              <CompanyAvatar company={row.company} size={32} />
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
          ...numberColumn(column.id),
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
          ...numberColumn(column.id),
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
