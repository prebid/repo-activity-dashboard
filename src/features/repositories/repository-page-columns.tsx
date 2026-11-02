import { accountTypeLabels } from '@/models/github-account';
import { GitHubAccountLink } from '@/components/github/account-link';
import { Avatar } from '@/components/github/avatar';
import {
  RecordIdentity,
  RecordNumber,
  issueStatus,
  pullRequestStatus,
} from '@/components/github/record-identity';
import type { RecordStatusProps } from '@/components/github/record-status';
import type { DataColumn } from '@/components/tables/data-table';
import type {
  RepositoryPagePr,
  RepositoryPageIssue,
  LatestRecordActivity,
} from '@/models/repository-page';
import type { RepositoryIssue, RepositoryPullRequest } from '@/models/repository-records';
import type { MergedPullRequest, ReportingAccountType } from '@/models/repository-insights';
import { recordPrColumns, recordIssueColumns, actorLabels } from './record-base-columns';
import { formatUtcDate } from '@/lib/presentation/format';
import styles from './repository-page.module.css';

// The record row shows these values inline: status and labels under the title, the author type
// beside the author. They stay columns for search and export, outside the Columns menu.
export const repositoryInlineColumnIds: ReadonlySet<string> = new Set([
  'labels',
  'state',
  'authorType',
]);

type Row = (RepositoryPullRequest | RepositoryIssue) & {
  authorType: ReportingAccountType | null;
};
const authorLabels = accountTypeLabels;
function recordStatus(row: Row): RecordStatusProps {
  return 'draft' in row ? pullRequestStatus(row.state, row.draft) : issueStatus(row.state);
}
function Activity({ activity }: { activity: LatestRecordActivity | null }) {
  return activity ? (
    <div className={styles.activity}>
      <time dateTime={activity.at} title={activity.at}>
        {formatUtcDate(activity.at)}
      </time>
      <span className={styles.secondary} title={activity.account ?? undefined}>
        {actorLabels[activity.category]}
      </span>
    </div>
  ) : (
    <span title="Latest activity unavailable">—</span>
  );
}
function presentation<T extends Row>(columns: DataColumn<T>[]): DataColumn<T>[] {
  return columns.map((column) => {
    if (column.id === 'number')
      return {
        ...column,
        width: 82,
        pinned: true,
        hideable: false,
        cell: (row: T) => <RecordNumber number={row.number} url={row.url} />,
      };
    if (column.id === 'title')
      return {
        ...column,
        width: 360,
        hideable: false,
        cell: (row: T) => (
          <RecordIdentity
            title={row.title}
            url={row.url}
            status={recordStatus(row)}
            labels={row.labels}
          />
        ),
      };
    if (column.id === 'author')
      return {
        ...column,
        width: 170,
        cell: (row: T) => (
          <div className={styles.account}>
            <Avatar kind="person" name={row.author} accountType={row.authorType} size={32} />
            <div className={styles.author}>
              <GitHubAccountLink login={row.author} url={row.authorUrl} />
              <span className={styles.secondary}>
                {row.authorType === null ? '—' : authorLabels[row.authorType]}
              </span>
            </div>
          </div>
        ),
      };
    if (['humanReviewers', 'approvals'].includes(column.id))
      return {
        ...column,
        width: column.id === 'approvals' ? 152 : 128,
        align: 'right',
        value: (row: T) => ('draft' in row && row.draft ? null : column.value(row)),
        cell: (row: T) =>
          'draft' in row && row.draft ? (
            <span title="Not applicable to drafts">—</span>
          ) : (
            <span>{column.value(row) ?? '—'}</span>
          ),
      };
    if (column.id === 'ageDays') return { ...column, width: 100, align: 'right' };
    return {
      ...column,
      width:
        column.id === 'createdAt' || column.id === 'mergedAt' || column.id === 'closedAt'
          ? 128
          : column.width,
    };
  });
}
function authorTypeColumn<T extends Row>(): DataColumn<T> {
  return {
    id: 'authorType',
    selectionGroup: 'Identity',
    label: 'Author category',
    value: (row) => (row.authorType === null ? null : authorLabels[row.authorType]),
  };
}
function metadata<T extends RepositoryPagePr | RepositoryPageIssue>(): DataColumn<T>[] {
  return [
    authorTypeColumn<T>(),
    {
      id: 'latestActivity',
      selectionGroup: 'Latest activity',
      label: 'Latest activity',
      description:
        'The latest qualifying activity at the reporting snapshot, with its actor category. This is separate from reviewer participation and approval state.',
      width: 164,
      sortValue: (row) => row.latestActivity?.at ?? null,
      value: (row) =>
        row.latestActivity
          ? row.latestActivity.at +
            ' · ' +
            actorLabels[row.latestActivity.category] +
            ' · ' +
            (row.latestActivity.account ?? '')
          : null,
      cell: (row) => <Activity activity={row.latestActivity} />,
    },
  ];
}
/** The merge-duration insight's merged PRs: the record pages' PR columns without Latest activity. */
export const repositoryMergedPrColumns: DataColumn<MergedPullRequest>[] = [
  ...presentation<MergedPullRequest>(recordPrColumns),
  authorTypeColumn<MergedPullRequest>(),
];
export const repositoryPagePrColumns: DataColumn<RepositoryPagePr>[] = [
  ...presentation<RepositoryPagePr>(recordPrColumns),
  ...metadata<RepositoryPagePr>(),
];
export const repositoryPageIssueColumns: DataColumn<RepositoryPageIssue>[] = [
  ...presentation<RepositoryPageIssue>(recordIssueColumns),
  ...metadata<RepositoryPageIssue>(),
  {
    id: 'assignees',
    selectionGroup: 'Identity',
    label: 'Assignees',
    description:
      'Current assigned accounts. Unassigned is a known empty assignment list; a dash means the assignment information is unavailable.',
    width: 170,
    value: (row) =>
      row.assignees === null
        ? null
        : row.assignees.length
          ? row.assignees.join(', ')
          : 'Unassigned',
    cell: (row) =>
      row.assignees === null ? (
        <span title="Assignment information unavailable">—</span>
      ) : row.assignees.length ? (
        row.assignees.join(', ')
      ) : (
        <span className={styles.secondary}>Unassigned</span>
      ),
  },
];
