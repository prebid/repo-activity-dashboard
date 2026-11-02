'use client';
import type { ReactNode } from 'react';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import Link from 'next/link';
import { GitHubAccountLink } from '@/components/github/account-link';
import { AccountTypeLabel, Avatar, type AvatarAccountType } from '@/components/github/avatar';
import {
  RecordIdentity,
  RecordNumber,
  pullRequestStatus,
} from '@/components/github/record-identity';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { Callout } from '@/components/feedback/callout';
import { EmptyState } from '@/components/feedback/empty-state';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import drillable from '@/components/metrics/drillable-number.module.css';
import type { TableController } from '@/lib/presentation/table-controller';
import { formatCount, formatUtcDate } from '@/lib/presentation/format';
import { accountTypeLabels } from '@/models/github-account';
import { insightTitles } from '@/lib/presentation/repository-insights';
import type {
  RepositoryInsight,
  RepositoryAuthor,
  RepositoryContribution,
} from '@/models/repository-insights';
import { RepositoryDrilldownFrame } from './repository-drilldown-frame';
import { RepositoryRecordTable } from './repository-records-view';
import pageStyles from './repository-page.module.css';
import { repositoryAuthorRecordsHref } from '@/lib/presentation/repository-author-records';
function quantity(value: number | null, unit: string) {
  return formatCount(value) + ' ' + unit + (value === 1 ? '' : 's');
}

function AccountIdentity({
  login,
  url,
  type,
}: {
  login: string;
  url?: string;
  type: AvatarAccountType;
}) {
  return (
    <div className={pageStyles.account}>
      <Avatar kind="person" name={login} accountType={type} size={32} />
      <GitHubAccountLink login={login} url={url} />
      <AccountTypeLabel accountType={type} />
    </div>
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
      pinned: true,
      hideable: false,
      value: (row) => row.account,
      cell: (row) => (
        <AccountIdentity login={row.account} url={row.profileUrl} type={row.accountType} />
      ),
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
          className={drillable.link}
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
    pinned: true,
    hideable: false,
    value: (row) => row.account,
    cell: (row) => (
      <AccountIdentity login={row.account} url={row.profileUrl} type={row.accountType} />
    ),
  },
  {
    id: 'pr',
    selectionGroup: 'Records',
    label: 'PR',
    width: 100,
    value: (row) => row.pr.number,
    cell: (row) => <RecordNumber number={row.pr.number} url={row.pr.url} />,
  },
  {
    id: 'title',
    selectionGroup: 'Records',
    label: 'Title',
    width: 400,
    value: (row) => row.pr.title,
    cell: (row) => (
      <RecordIdentity
        title={row.pr.title}
        url={row.pr.url}
        status={pullRequestStatus(row.pr.state, row.pr.draft)}
      />
    ),
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
  timelineHref,
  onTimeline,
  timelinePending,
}: {
  insight: RepositoryInsight;
  navigation?: RepositoryPageNavigation;
  timelineHref?: string | null;
  onTimeline?: React.MouseEventHandler<HTMLAnchorElement>;
  timelinePending?: boolean;
  controller: TableController;
}) {
  const title = insightTitles[insight.drilldown.selection.metric],
    measurement = insight.measurement;
  let summary: ReactNode[];
  if (insight.kind === 'duration')
    summary = [
      <>
        Median merge time: <MeasurementValue measurement={insight.days} unit="days" />
      </>,
      quantity(measurement.value, 'merged PR'),
    ];
  else if (insight.kind === 'authors') summary = [quantity(measurement.value, 'unique account')];
  else
    summary = [
      quantity(measurement.value, 'contribution credit'),
      quantity(new Set(insight.rows.map((row) => row.pr.id)).size, 'distinct PR'),
    ];
  return (
    <RepositoryDrilldownFrame
      context={insight}
      navigation={navigation}
      timelineHref={timelineHref}
      onTimeline={onTimeline}
      timelinePending={timelinePending}
      title={title}
      measurement={measurement}
      summary={summary}
    >
      {insight.kind === 'authors' ? (
        <DataTable
          search="local"
          key={JSON.stringify(insight.drilldown.selection)}
          title={title}
          rows={insight.rows}
          columns={authorColumns(insight.recordKind, (account) =>
            repositoryAuthorRecordsHref(
              insight.repository,
              insight.drilldown,
              account,
              pendingTableQuery(controller),
            ),
          )}
          controller={controller}
          itemLabel={{ singular: 'author', plural: 'authors' }}
          footerNote="One row per account in this repository and period, including humans, Prebid agents, and other bots. Sample record links are placeholders."
        />
      ) : insight.kind === 'contributions' ? (
        <DataTable
          search="local"
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
            <Callout tone="warning" as="p" role="status">
              Partial merge-duration coverage: {insight.days.reason}
            </Callout>
          )}
          {measurement.value === 0 ? (
            <EmptyState kind="empty" title="No merged PRs in this period">
              Median merge time is not applicable.
            </EmptyState>
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
