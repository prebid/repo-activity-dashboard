'use client';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import Link from 'next/link';
import { GitHubAccountLink } from '@/components/github/account-link';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { PageState } from '@/components/feedback/page-state';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import type { TableController } from '@/lib/presentation/table-controller';
import { formatCount, formatUtcDate } from '@/lib/presentation/format';
import { accountTypeLabels } from '@/models/github-account';
import { insightTitles } from '@/lib/presentation/repository-insights';
import type {
  RepositoryInsight,
  RepositoryAuthor,
  RepositoryContribution,
  SupportingRecord,
} from '@/models/repository-insights';
import { RepositoryDrilldownFrame } from './repository-drilldown-frame';
import { RepositoryRecordTable } from './repository-records-view';
import styles from './repository-records.module.css';
import { repositoryAuthorRecordsHref } from '@/lib/presentation/repository-author-records';
function quantity(value: number | null, unit: string) {
  return formatCount(value) + ' ' + unit + (value === 1 ? '' : 's');
}

function RecordLink({ record }: { record: SupportingRecord }) {
  return (
    <Link
      prefetch={false}
      href={record.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.recordLink}
    >
      {record.title}
      {record.draft ? ' (Draft)' : ''}
    </Link>
  );
}
export function authorColumns(
  kind: 'prs' | 'issues',
  recordsHref: (account: string) => string,
): DataColumn<RepositoryAuthor>[] {
  const label = kind === 'prs' ? 'PRs' : 'Issues';
  return [
    {
      id: 'account',
      selectionGroup: 'Identity',
      label: 'GitHub account',
      width: 220,
      hideable: false,
      value: (row) => row.account,
      cell: (row) => <GitHubAccountLink login={row.account} url={row.profileUrl} />,
    },
    {
      id: 'accountType',
      selectionGroup: 'Identity',
      label: 'Account type',
      width: 130,
      value: (row) => accountTypeLabels[row.accountType],
    },
    {
      id: 'recordCount',
      selectionGroup: 'Records',
      label,
      width: 100,
      align: 'right',
      value: (row) => row.recordCount,
    },
    {
      id: 'records',
      selectionGroup: 'Records',
      label: 'Records',
      width: 180,
      value: (row) => 'View ' + quantity(row.recordCount, kind === 'prs' ? 'PR' : 'Issue'),
      cell: (row) => (
        <Link
          prefetch={false}
          className={styles.recordLink}
          href={recordsHref(row.account)}
          aria-label={
            'View ' +
            quantity(row.recordCount, kind === 'prs' ? 'PR' : 'Issue') +
            ' by ' +
            row.account
          }
        >
          View {quantity(row.recordCount, kind === 'prs' ? 'PR' : 'Issue')}
        </Link>
      ),
    },
  ];
}
export const contributionDetailColumns: DataColumn<RepositoryContribution>[] = [
  {
    id: 'account',
    selectionGroup: 'Identity',
    label: 'GitHub account',
    width: 210,
    hideable: false,
    value: (row) => row.account,
    cell: (row) => <GitHubAccountLink login={row.account} url={row.profileUrl} />,
  },
  { id: 'pr', selectionGroup: 'Records', label: 'PR', width: 100, value: (row) => row.pr.number },
  {
    id: 'title',
    selectionGroup: 'Records',
    label: 'Title',
    width: 400,
    value: (row) => row.pr.title,
    cell: (row) => <RecordLink record={row.pr} />,
  },
  {
    id: 'firstCreditAt',
    selectionGroup: 'Activity',
    label: 'First credited',
    width: 160,
    description:
      'First qualifying action for this account, PR, and contribution type. Repeated actions do not create additional credits.',
    value: (row) => row.firstCreditAt,
    cell: (row) => (
      <time dateTime={row.firstCreditAt} title={row.firstCreditAt}>
        {formatUtcDate(row.firstCreditAt)}
      </time>
    ),
  },
];
export function RepositoryInsightsView({
  insight,
  controller,
  navigation,
}: {
  insight: RepositoryInsight;
  navigation?: RepositoryPageNavigation;
  controller: TableController;
}) {
  const title = insightTitles[insight.drilldown.selection.metric],
    measurement = insight.measurement;
  let summary;
  if (insight.kind === 'duration')
    summary = (
      <>
        <span>
          Median merge time: <MeasurementValue measurement={insight.days} unit="days" />
        </span>
        <span>{quantity(measurement.value, 'merged PR')}</span>
      </>
    );
  else if (insight.kind === 'authors')
    summary = <span>{quantity(measurement.value, 'unique account')}</span>;
  else
    summary = (
      <>
        <span>{quantity(measurement.value, 'contribution credit')}</span>
        <span>{quantity(new Set(insight.rows.map((row) => row.pr.id)).size, 'distinct PR')}</span>
      </>
    );
  return (
    <RepositoryDrilldownFrame
      context={insight}
      navigation={navigation}
      title={title}
      measurement={measurement}
      summary={summary}
    >
      {insight.kind === 'authors' ? (
        <DataTable
          key={JSON.stringify(insight.drilldown.selection)}
          title={title}
          rows={insight.rows}
          columns={authorColumns(insight.recordKind, (account) =>
            repositoryAuthorRecordsHref(insight.repository, insight.drilldown, account, {
              ...controller.query,
              search: controller.draftSearch,
              page: controller.draftSearch === controller.query.search ? controller.query.page : 1,
            }),
          )}
          controller={controller}
          itemLabel={{ singular: 'author', plural: 'authors' }}
          footerNote="One row per account in this repository and period, including humans, Prebid agents, and other bots. Sample record links are placeholders."
        />
      ) : insight.kind === 'contributions' ? (
        <DataTable
          key={JSON.stringify(insight.drilldown.selection)}
          title={title}
          rows={insight.rows}
          columns={contributionDetailColumns}
          controller={controller}
          itemLabel={{ singular: 'contribution credit', plural: 'contribution credits' }}
          footerNote="One credit per account, PR, and contribution type, in the period of its first qualifying action. Multiple accounts can contribute to one PR. Sample links are placeholders."
        />
      ) : (
        <>
          {insight.days.status === 'partial' && (
            <p role="status" className={styles.notice}>
              Partial merge-duration coverage: {insight.days.reason}
            </p>
          )}
          {measurement.value === 0 ? (
            <PageState title="No merged PRs in this period">
              Median merge time is not applicable.
            </PageState>
          ) : (
            <RepositoryRecordTable
              key={JSON.stringify(insight.drilldown.selection)}
              list={insight.records}
              controller={controller}
              title="Merged PRs and durations"
              showMergeDuration
            />
          )}
        </>
      )}
    </RepositoryDrilldownFrame>
  );
}
