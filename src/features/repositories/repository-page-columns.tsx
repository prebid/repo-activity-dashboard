import Link from 'next/link';
import { GitPullRequest, GitMerge, CircleDot, CircleCheck } from 'lucide-react';
import type { DataColumn } from '@/components/tables/data-table';
import type {
  RepositoryPagePr,
  RepositoryPageIssue,
  LatestRecordActivity,
} from '@/models/repository-page';
import { recordPrColumns, recordIssueColumns, actorLabels } from './repository-records-view';
import { formatUtcDate } from '@/lib/presentation/format';
import styles from './repository-page.module.css';

export const repositoryInlineColumnIds: ReadonlySet<string> = new Set([
  'labels',
  'state',
  'authorType',
]);

type Row = RepositoryPagePr | RepositoryPageIssue;
const authorLabels = { human: 'Human', agent: 'Prebid agent', bot: 'Bot' };
function RecordIdentity({ row }: { row: Row }) {
  const state = 'draft' in row && row.draft ? 'Draft' : row.state;
  return (
    <div className={styles.identity}>
      <Link
        prefetch={false}
        href={row.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.titleLink}
      >
        {row.title}
      </Link>
      <div className={styles.recordMeta}>
        <span className={styles.state} data-state={state}>
          {state === 'Merged' ? (
            <GitMerge size={12} aria-hidden="true" />
          ) : state === 'Closed' ? (
            <CircleCheck size={12} aria-hidden="true" />
          ) : 'draft' in row ? (
            <GitPullRequest size={12} aria-hidden="true" />
          ) : (
            <CircleDot size={12} aria-hidden="true" />
          )}
          {state}
        </span>
        {row.labels.map((label) => (
          <span key={label} className={styles.label}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
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
        cell: (row: T) => (
          <Link
            prefetch={false}
            className={styles.number}
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {row.number}
          </Link>
        ),
      };
    if (column.id === 'title')
      return {
        ...column,
        width: 360,
        hideable: false,
        cell: (row: T) => <RecordIdentity row={row} />,
      };
    if (column.id === 'author')
      return {
        ...column,
        width: 170,
        cell: (row: T) => (
          <div className={styles.author}>
            <span>{row.author}</span>
            <span className={styles.secondary}>
              {row.authorType === null ? '—' : authorLabels[row.authorType]}
            </span>
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
function metadata<T extends Row>(): DataColumn<T>[] {
  return [
    {
      id: 'authorType',
      label: 'Author category',
      value: (row) => (row.authorType === null ? null : authorLabels[row.authorType]),
    },
    {
      id: 'latestActivity',
      label: 'Latest activity',
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
export const repositoryPagePrColumns: DataColumn<RepositoryPagePr>[] = [
  ...presentation<RepositoryPagePr>(recordPrColumns),
  ...metadata<RepositoryPagePr>(),
];
export const repositoryPageIssueColumns: DataColumn<RepositoryPageIssue>[] = [
  ...presentation<RepositoryPageIssue>(recordIssueColumns),
  ...metadata<RepositoryPageIssue>(),
  {
    id: 'assignees',
    label: 'Assignees',
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
