import Link from 'next/link';
import type { DataColumn } from '@/components/tables/data-table';
import { MeasurementDifference } from '@/components/metrics/measurement-value';
import type {
  ActivityMetric,
  BacklogMetric,
  RepositoryActivity,
  RepositoryOverviewRow,
  RepositoryActivityRow,
} from '@/models/repository-overview';
import { activityMetricIds, agingThresholds, backlogMetricIds } from '@/models/repository-overview';
import type { Measurement } from '@/models/reporting-measurement';
import { agingColumnId, agingThresholdForColumn } from '@/lib/presentation/overview-aging';
import { measurementMarks, type DataLegendMark } from '@/components/feedback/data-legend';
import {
  activityMetricText,
  agedPrsText,
  backlogMetricText,
  type RepositoryActivityTextMetric,
} from '@/lib/presentation/repository-metric-text';
import { absoluteChange } from '@/lib/presentation/measurement';
import { activityPeriodLabel } from '@/lib/presentation/overview-periods';
import styles from './overview.module.css';
import { OverviewMetric } from './overview-metric';
import { metricName } from '@/models/column-selection';

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
  function backlogColumn(id: BacklogMetric): DataColumn<OverviewTableRow> {
    const { label, group, description } = backlogMetricText[id];
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
          label={metricName({ group, label })}
          returnTo={returnTo}
        />
      ),
    };
  }

  return [
    repositoryColumn(returnTo),
    backlogColumn('totalOpenPrs'),
    backlogColumn('draftPrs'),
    backlogColumn('nonDraftPrs'),
    backlogColumn('openIssues'),
    ...agingThresholds.map((age): DataColumn<OverviewTableRow> => ({
      id: agingColumnId(age),
      ...agedPrsText(age),
      width: 110,
      align: 'right',
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
    backlogColumn('humanApprovals0'),
    backlogColumn('humanApprovals1'),
    backlogColumn('humanApprovals2'),
    backlogColumn('humanApprovalsMoreThan2'),
    backlogColumn('humanReviewers0'),
    backlogColumn('humanReviewers1'),
    backlogColumn('humanReviewers2'),
    backlogColumn('humanReviewersMoreThan2'),
    backlogColumn('agentFeedbackPrs'),
    backlogColumn('botFeedbackPrs'),
    backlogColumn('lastAgent'),
    backlogColumn('lastBot'),
    backlogColumn('lastPrebidReviewer'),
    backlogColumn('lastContributor'),
    backlogColumn('lastOtherHuman'),
    backlogColumn('lastUnknown'),
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
    id: Exclude<RepositoryActivityTextMetric, 'medianMergeDays'>,
  ): DataColumn<RepositoryActivityRow> {
    const { label, group, description } = activityMetricText[id];
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
            label={metricName({ group, label }) + ' — ' + activityPeriodLabel(row.period)}
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
                <span className={styles.periodTag}>Period {row.periodIndex + 1}</span>
                <span className="sr-only">: </span>
                <span>{activityPeriodLabel(row.period)}</span>
              </span>
            )}
          </div>
        ),
    },
    activityColumn('prsOpened'),
    activityColumn('prsMerged'),
    activityColumn('issuesOpened'),
    activityColumn('issuesClosed'),
    activityColumn('prAuthors'),
    activityColumn('issueAuthors'),
    {
      id: 'medianMergeDays',
      ...activityMetricText.medianMergeDays,
      width: 144,
      align: 'right',
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
    activityColumn('agentFeedbackCredits'),
    activityColumn('agentApprovalCredits'),
    activityColumn('botFeedbackCredits'),
    activityColumn('botApprovalCredits'),
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

type CellMeasurement = Pick<Measurement, 'status'> | undefined;

/** The measurement a Current backlog cell shows; the repository cell shows none. */
export function backlogCellMeasurement(row: OverviewTableRow, columnId: string): CellMeasurement {
  const age = agingThresholdForColumn(columnId);
  if (age !== undefined) return row.backlog.agedPrs[age];
  return (backlogMetricIds as readonly string[]).includes(columnId)
    ? row.backlog.counts[columnId as BacklogMetric]
    : undefined;
}

/**
 * The measurement a Period activity cell shows. A difference cell shows a dash unless both
 * periods are complete, so it counts as missing then.
 */
export function activityCellMeasurement(
  row: RepositoryActivityRow,
  columnId: string,
): CellMeasurement {
  const read = (activity: RepositoryActivity): Measurement | undefined =>
    columnId === 'medianMergeDays'
      ? activity.mergeDuration.days
      : (activityMetricIds as readonly string[]).includes(columnId)
        ? activity.counts[columnId as ActivityMetric]
        : undefined;
  if (row.kind === 'period') return read(row.activity);
  const first = read(row.primary),
    second = read(row.secondary);
  if (!first || !second) return undefined;
  return { status: absoluteChange(first, second) === null ? 'missing' : 'complete' };
}

/** The value marks a table's visible columns show across all its rows, for its DataLegend. */
export function overviewLegend<T>(
  rows: readonly T[],
  columns: readonly DataColumn<T>[],
  visibility: Record<string, boolean>,
  measurement: (row: T, columnId: string) => CellMeasurement,
): DataLegendMark[] {
  const shown = columns.filter(
    (column) => column.hideable === false || visibility[column.id] !== false,
  );
  return measurementMarks(
    rows.flatMap((row) =>
      shown.flatMap((column) => {
        const value = measurement(row, column.id);
        return value ? [value] : [];
      }),
    ),
  );
}

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
