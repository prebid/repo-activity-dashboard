import Link from 'next/link';
import type { DataColumn } from '@/components/tables/data-table';
import { MeasurementDifference } from '@/components/metrics/measurement-value';
import type {
  ActivityMetric,
  BacklogMetric,
  RepositoryOverviewRow,
  RepositoryActivityRow,
} from '@/models/repository-overview';
import { agingThresholds } from '@/models/repository-overview';
import { agingColumnId } from '@/lib/presentation/overview-aging';
import { absoluteChange } from '@/lib/presentation/measurement';
import { activityPeriodLabel } from '@/lib/presentation/overview-periods';
import styles from './overview.module.css';
import { OverviewMetric } from './overview-metric';

export type OverviewTableRow = RepositoryOverviewRow & { id: string };
function repositoryColumn(returnTo: string): DataColumn<OverviewTableRow> {
  return {
    id: 'name',
    selectionGroup: 'Identity',
    label: 'Repository',
    width: 248,
    pinned: true,
    hideable: false,
    value: (row) => row.repository.name,
    cell: (row) => (
      <Link
        prefetch={false}
        href={
          '/repos/' +
          row.repository.slug +
          (returnTo === '/repos' ? '' : '?returnTo=' + encodeURIComponent(returnTo))
        }
        className={styles.repositoryLink}
        title={'Primary branch: ' + row.repository.primaryBranch}
      >
        {row.repository.name}
      </Link>
    ),
  };
}

export function backlogColumns(returnTo = '/repos'): DataColumn<OverviewTableRow>[] {
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
      cell: (row) => (
        <OverviewMetric
          repository={row.repository}
          measurement={row.backlog.counts[id]}
          selection={{ scope: 'current', metric: id }}
          label={group + ' — ' + label}
          returnTo={returnTo}
        />
      ),
    };
  }

  return [
    repositoryColumn(returnTo),
    backlogColumn(
      'totalOpenPrs',
      'Total PRs',
      'Pull requests',
      'All currently open PRs, including drafts.',
    ),
    backlogColumn('draftPrs', 'Drafts', 'Pull requests', 'Currently open draft PRs.'),
    backlogColumn('nonDraftPrs', 'Open', 'Pull requests', 'Currently open PRs, excluding drafts.'),
    backlogColumn(
      'openIssues',
      'Open',
      'Issues',
      'Currently open issues, excluding pull requests.',
    ),
    ...agingThresholds.map((age): DataColumn<OverviewTableRow> => ({
      id: agingColumnId(age),
      label: 'Over ' + age + ' days',
      group: 'PR age',
      width: 110,
      align: 'right',
      description: 'Non-draft PRs created more than ' + age + ' days ago.',
      value: (row) => row.backlog.agedPrs[age].value,
      cell: (row) => (
        <OverviewMetric
          repository={row.repository}
          measurement={row.backlog.agedPrs[age]}
          selection={{ scope: 'current', metric: 'agedPrs', ageDays: age }}
          label={'PRs older than ' + age + ' days'}
          returnTo={returnTo}
        />
      ),
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
    backlogColumn(
      'humanApprovalsMoreThan2',
      'More than 2 approvals',
      'Human approvals',
      'Open non-draft PRs with more than two current human approvers.',
    ),
    backlogColumn(
      'humanReviewers0',
      '0 reviewers',
      'Human reviewers',
      'Open non-draft PRs with no non-author human comments or requests for changes. An approval alone does not count as reviewer participation.',
    ),
    backlogColumn(
      'humanReviewers1',
      '1 reviewer',
      'Human reviewers',
      'Open non-draft PRs with exactly one distinct non-author human who has provided a qualifying comment or request for changes. Approvals are separate.',
    ),
    backlogColumn(
      'humanReviewers2',
      '2 reviewers',
      'Human reviewers',
      'Open non-draft PRs with exactly two distinct non-author human reviewers. Repeated comments by the same account do not add reviewers.',
    ),
    backlogColumn(
      'humanReviewersMoreThan2',
      'More than 2 reviewers',
      'Human reviewers',
      'Open non-draft PRs with more than two distinct non-author human reviewers; these values are not capped at two.',
    ),
    backlogColumn(
      'agentFeedbackPrs',
      'Prebid agents',
      'Reviewer coverage',
      'Open non-draft PRs with at least one qualifying Prebid agent reviewer.',
    ),
    backlogColumn(
      'botFeedbackPrs',
      'Bots',
      'Reviewer coverage',
      'Open non-draft PRs with at least one qualifying bot reviewer, excluding Prebid agents.',
    ),
    backlogColumn(
      'lastAgent',
      'Agent last',
      'Latest activity',
      'Open non-draft PRs whose latest qualifying activity came from a mapped Prebid agent.',
    ),
    backlogColumn(
      'lastBot',
      'Bot last',
      'Latest activity',
      'Open non-draft PRs whose latest qualifying activity came from another bot, excluding mapped Prebid agents.',
    ),
    backlogColumn(
      'lastPrebidReviewer',
      'Reviewer last',
      'Latest activity',
      'Open non-draft PRs whose latest qualifying activity came from a mapped Prebid human reviewer.',
    ),
    backlogColumn(
      'lastContributor',
      'Contributor last',
      'Latest activity',
      'Open non-draft PRs whose latest qualifying activity came from the PR contributor.',
    ),
    backlogColumn(
      'lastOtherHuman',
      'Other human last',
      'Latest activity',
      'Open non-draft PRs whose latest qualifying activity came from another human account.',
    ),
    backlogColumn(
      'lastUnknown',
      'Unknown actor',
      'Latest activity',
      'Open non-draft PRs with a known latest activity whose actor is unclassified. Unavailable activity history is separate and may make counts partial.',
    ),
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

export function activityColumns(returnTo = '/repos'): DataColumn<RepositoryActivityRow>[] {
  function activityColumn(
    id: ActivityMetric,
    label: string,
    group: string,
    description?: string,
  ): DataColumn<RepositoryActivityRow> {
    return {
      id,
      label,
      group,
      description,
      width: 116,
      align: 'right',
      value: (row) =>
        row.kind === 'difference'
          ? absoluteChange(row.primary.counts[id], row.secondary.counts[id])
          : row.activity.counts[id].value,
      sortValue: (row) => row.sortActivity.counts[id].value,
      cell: (row) =>
        row.kind === 'difference' ? (
          <MeasurementDifference first={row.primary.counts[id]} second={row.secondary.counts[id]} />
        ) : (
          <OverviewMetric
            repository={row.repository}
            measurement={row.activity.counts[id]}
            selection={{
              scope: 'period',
              metric: id,
              range: row.period.range,
              ...(id === 'prsMerged' ? { branch: row.repository.primaryBranch } : {}),
            }}
            label={group + ' — ' + label + ' — ' + activityPeriodLabel(row.period)}
            returnTo={returnTo}
          />
        ),
    };
  }
  return [
    {
      ...repositoryColumn(returnTo),
      sortGroup: undefined,
      value: (row) =>
        row.repository.name +
        (row.kind === 'difference'
          ? ' (Difference: Period 1 minus Period 2)'
          : row.showPeriodLabel
            ? ' (' + activityPeriodLabel(row.period) + ')'
            : ''),
      sortValue: (row) => row.repository.name,
      cell: (row) =>
        row.kind === 'difference' ? (
          <span className={styles.differenceLabel}>
            <span className="sr-only">{row.repository.name}: </span>Difference
            <span className="sr-only">, Period 1 minus Period 2</span>
          </span>
        ) : (
          <div>
            {row.periodIndex === 0 ? (
              <Link
                prefetch={false}
                href={
                  '/repos/' +
                  row.repository.slug +
                  (returnTo === '/repos' ? '' : '?returnTo=' + encodeURIComponent(returnTo))
                }
                className={styles.repositoryLink}
                title={'Primary branch: ' + row.repository.primaryBranch}
              >
                {row.repository.name}
              </Link>
            ) : (
              <span className="sr-only">{row.repository.name}: </span>
            )}
            {row.showPeriodLabel && (
              <span className={styles.periodLabel}>
                <span className="sr-only">Period {row.periodIndex + 1}: </span>
                {activityPeriodLabel(row.period)}
              </span>
            )}
          </div>
        ),
    },
    activityColumn(
      'prsOpened',
      'Opened',
      'Pull requests',
      'PRs created during this period, including drafts.',
    ),
    activityColumn(
      'prsMerged',
      'Merged',
      'Pull requests',
      'PRs merged into each repository’s primary branch during this period.',
    ),
    activityColumn(
      'issuesOpened',
      'Opened',
      'Issues',
      'Issues created during the selected period, excluding pull requests.',
    ),
    activityColumn(
      'issuesClosed',
      'Closed',
      'Issues',
      'Issues closed during the selected period, including those subsequently reopened.',
    ),
    activityColumn(
      'prAuthors',
      'PRs',
      'Unique authors',
      'Distinct accounts that authored PRs in this repository during the period.',
    ),
    activityColumn(
      'issueAuthors',
      'Issues',
      'Unique authors',
      'Distinct accounts that authored issues in this repository during the period.',
    ),
    {
      id: 'medianMergeDays',
      label: 'Median merge time',
      group: 'Duration',
      width: 144,
      align: 'right',
      description:
        'Median time from PR creation to merge. Includes only primary-branch merges in the period.',
      value: (row) =>
        row.kind === 'difference'
          ? absoluteChange(row.primary.mergeDuration.days, row.secondary.mergeDuration.days)
          : row.activity.mergeDuration.days.value,
      sortValue: (row) => row.sortActivity.mergeDuration.days.value,
      cell: (row) =>
        row.kind === 'difference' ? (
          <MeasurementDifference
            first={row.primary.mergeDuration.days}
            second={row.secondary.mergeDuration.days}
            unit="days"
          />
        ) : (
          <OverviewMetric
            repository={row.repository}
            measurement={row.activity.mergeDuration.days}
            unit="days"
            selection={{
              scope: 'period',
              metric: 'medianMergeDays',
              range: row.period.range,
              branch: row.repository.primaryBranch,
            }}
            label={'Median merge time — ' + activityPeriodLabel(row.period)}
            returnTo={returnTo}
            detail={
              row.activity.mergeDuration.sampleSize.value === null
                ? undefined
                : row.activity.mergeDuration.sampleSize.value +
                  ' merged PRs · ' +
                  row.repository.primaryBranch
            }
          />
        ),
    },
    activityColumn(
      'agentFeedbackCredits',
      'Agent reviewers',
      'Prebid agents',
      'Reviewer contributions from Prebid agents, counted once per agent and PR in the period of its first qualifying review.',
    ),
    activityColumn(
      'agentApprovalCredits',
      'Agent approvals',
      'Prebid agents',
      'Approval contributions from Prebid agents, counted once per account and PR on its first approval date; reapprovals do not add credits.',
    ),
    activityColumn(
      'botFeedbackCredits',
      'Bot reviewers',
      'Bots',
      'Reviewer contributions from other bots, counted once per bot and PR in the period of its first qualifying review.',
    ),
    activityColumn(
      'botApprovalCredits',
      'Bot approvals',
      'Bots',
      'Approval contributions from other bots, counted once per account and PR on its first approval date; these are separate from current approvals.',
    ),
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
  activityColumns: activityColumns().map((column) => column.id),
  defaultBacklogColumns,
  defaultActivityColumns,
};
