import Link from 'next/link';
import type { DataColumn } from '@/components/tables/data-table';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import type {
  ActivityMetric,
  BacklogMetric,
  RepositoryOverviewRow,
} from '@/models/repository-overview';
import { agingThresholds } from '@/models/repository-overview';
import { agingColumnId } from '@/lib/presentation/overview-aging';
import styles from './overview.module.css';

export type OverviewTableRow = RepositoryOverviewRow & { id: string };
const repositoryColumn: DataColumn<OverviewTableRow> = {
  id: 'name',
  label: 'Repository',
  width: 248,
  pinned: true,
  hideable: false,
  value: (row) => row.repository.name,
  cell: (row) => (
    <Link
      prefetch={false}
      href={'/repos/' + row.repository.slug}
      className={styles.repositoryLink}
      title={'Primary branch: ' + row.repository.primaryBranch}
    >
      {row.repository.name}
    </Link>
  ),
};

function backlogColumn(
  id: BacklogMetric,
  label: string,
  group: string,
  description?: string,
): DataColumn<OverviewTableRow> {
  return {
    id,
    label,
    group,
    description,
    width: 106,
    align: 'right',
    value: (row) => row.backlog.counts[id].value,
    cell: (row) => <MeasurementValue measurement={row.backlog.counts[id]} />,
  };
}

export function backlogColumns(): DataColumn<OverviewTableRow>[] {
  return [
    repositoryColumn,
    backlogColumn(
      'totalOpenPrs',
      'Total open PRs',
      'Pull requests',
      'All currently open PRs, including drafts.',
    ),
    backlogColumn('draftPrs', 'Drafts', 'Pull requests'),
    backlogColumn('nonDraftPrs', 'Non-drafts', 'Pull requests'),
    backlogColumn('openIssues', 'Open issues', 'Issues'),
    ...agingThresholds.map((age): DataColumn<OverviewTableRow> => ({
      id: agingColumnId(age),
      label: 'Over ' + age + ' days',
      group: 'PR age',
      width: 110,
      align: 'right',
      description: 'Non-draft PRs created more than ' + age + ' days ago.',
      value: (row) => row.backlog.agedPrs[age].value,
      cell: (row) => <MeasurementValue measurement={row.backlog.agedPrs[age]} />,
    })),
    backlogColumn(
      'humanApprovals0',
      '0 approvals',
      'Human approvals',
      'Open non-draft PRs with zero current human approvals.',
    ),
    backlogColumn(
      'humanApprovals1',
      '1 approval',
      'Human approvals',
      'Open non-draft PRs with one current human approver.',
    ),
    backlogColumn(
      'humanApprovals2',
      '2 approvals',
      'Human approvals',
      'Open non-draft PRs with two current human approvers.',
    ),
    backlogColumn('humanApprovalsMoreThan2', 'More than 2 approvals', 'Human approvals'),
    backlogColumn(
      'humanReviewers0',
      '0 reviewers',
      'Human feedback',
      'Open non-draft PRs with no non-author human comments or requests for changes. Approval alone is not feedback.',
    ),
    backlogColumn('humanReviewers1', '1 reviewer', 'Human feedback'),
    backlogColumn('humanReviewers2', '2 reviewers', 'Human feedback'),
    backlogColumn('humanReviewersMoreThan2', 'More than 2 reviewers', 'Human feedback'),
    backlogColumn('agentFeedbackPrs', 'Prebid agents', 'Feedback coverage'),
    backlogColumn('botFeedbackPrs', 'Other bots', 'Feedback coverage'),
    backlogColumn('lastAgent', 'Agent last', 'Latest activity'),
    backlogColumn('lastBot', 'Bot last', 'Latest activity'),
    backlogColumn('lastPrebidReviewer', 'Reviewer last', 'Latest activity'),
    backlogColumn('lastContributor', 'Contributor last', 'Latest activity'),
    backlogColumn('lastOtherHuman', 'Other human last', 'Latest activity'),
    backlogColumn('lastUnknown', 'Unknown actor', 'Latest activity'),
  ];
}
export const defaultBacklogColumns = [
  'name',
  'totalOpenPrs',
  'draftPrs',
  'nonDraftPrs',
  'openIssues',
  'humanApprovals0',
  'humanApprovals1',
  'humanApprovals2',
];

function activityColumn(
  id: ActivityMetric,
  label: string,
  group: string,
  showChange: boolean,
  description?: string,
): DataColumn<OverviewTableRow> {
  return {
    id,
    label,
    group,
    description,
    width: 116,
    align: 'right',
    value: (row) => row.activity.counts[id].value,
    cell: (row) => (
      <MeasurementValue
        measurement={row.activity.counts[id]}
        comparison={showChange ? row.comparison.counts[id] : undefined}
      />
    ),
  };
}
export function activityColumns(showChange: boolean): DataColumn<OverviewTableRow>[] {
  return [
    repositoryColumn,
    activityColumn(
      'prsOpened',
      'Opened',
      'Pull requests',
      showChange,
      'PRs created during this period, including drafts.',
    ),
    activityColumn(
      'prsMerged',
      'Merged',
      'Pull requests',
      showChange,
      'PRs merged into each repository’s primary branch during this period.',
    ),
    activityColumn('issuesOpened', 'Opened', 'Issues', showChange),
    activityColumn('issuesClosed', 'Closed', 'Issues', showChange),
    activityColumn('prAuthors', 'PR authors', 'Unique authors', showChange),
    activityColumn('issueAuthors', 'Issue authors', 'Unique authors', showChange),
    {
      id: 'medianMergeDays',
      label: 'Median merge time',
      group: 'Duration',
      width: 144,
      align: 'right',
      description:
        'Median time from PR creation to merge. Includes only primary-branch merges in the period.',
      value: (row) => row.activity.mergeDuration.days.value,
      cell: (row) => (
        <MeasurementValue
          measurement={row.activity.mergeDuration.days}
          unit="days"
          detail={
            row.activity.mergeDuration.sampleSize.value === null
              ? undefined
              : row.activity.mergeDuration.sampleSize.value +
                ' merged PRs · ' +
                row.repository.primaryBranch
          }
          comparison={showChange ? row.comparison.mergeDuration.days : undefined}
        />
      ),
    },
    activityColumn('agentFeedbackCredits', 'Agent feedback', 'Prebid agents', showChange),
    activityColumn('agentApprovalCredits', 'Agent approvals', 'Prebid agents', showChange),
    activityColumn('botFeedbackCredits', 'Bot feedback', 'Other bots', showChange),
    activityColumn('botApprovalCredits', 'Bot approvals', 'Other bots', showChange),
  ];
}
export const defaultActivityColumns = [
  'name',
  'prsOpened',
  'prsMerged',
  'issuesOpened',
  'issuesClosed',
  'prAuthors',
  'issueAuthors',
  'medianMergeDays',
];

export function columnVisibilityFromIds<T>(
  columns: DataColumn<T>[],
  defaults: readonly string[],
): Record<string, boolean> {
  return Object.fromEntries(columns.map((column) => [column.id, defaults.includes(column.id)]));
}

export const overviewSettingsColumns = {
  backlogColumns: backlogColumns().map((column) => column.id),
  activityColumns: activityColumns(false).map((column) => column.id),
  defaultBacklogColumns,
  defaultActivityColumns,
};
