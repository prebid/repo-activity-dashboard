'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { TableController } from '@/lib/presentation/table-controller';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  RepositoryTimelineMatrix,
  RepositoryTimelineMatrixRow,
} from '@/models/repository-timeline-matrix';
import {
  repositoryTimelineMatrixValues,
  repositoryTimelineMatrixWindow,
} from '@/lib/presentation/repository-timeline-matrix';
import {
  timelineIntervalDescription,
  timelineIntervalLabel,
} from '@/lib/presentation/timeline-presentation';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { TimelineScope } from '@/components/reporting/timeline-scope';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { useLocalTableController } from '@/components/tables/local-data-table';
import {
  TimelineCoverageNotice,
  TimelineLinkLimitNotice,
  TimelineValueCell,
  hasUnlinkedValue,
  isIncompleteValue,
  timelineFooterLegend,
} from '@/components/reporting/timeline-value';
import { PageState } from '@/components/feedback/page-state';
import { Button } from '@/components/ui/button';
import { AllRepositoriesHeading, AllRepositoriesTabs } from './all-repositories-header';
import { repositoryTimelineMetricDefinitions } from './repository-timeline-columns';
import timelineStyles from '@/components/reporting/timeline-layout.module.css';
import styles from './repository-timeline-matrix.module.css';
import {
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
} from '@/models/repository-timeline';
import { tablePageSize } from '@/models/table-query';
import { metricName } from '@/models/column-selection';
export interface MatrixInteractions {
  sortMetric?: RepositoryTimelineMetric;
  detailHref?: (row: RepositoryTimelineMatrixRow, interval: string) => string | null;
  exportControl?: React.ReactNode;
  pending?: boolean;
  table: TableController;
  window: { page: number; onChange: (page: number) => void };
  repositoryHref: (slug: string) => string | null;
}

export function RepositoryTimelineMatrixView({
  matrix,
  href,
  summaryHref,
  controls,
  interactions,
}: {
  matrix: RepositoryTimelineMatrix;
  href: string;
  summaryHref: string;
  controls?: React.ReactNode;
  interactions?: MatrixInteractions;
}) {
  const metrics = repositoryTimelineMetricDefinitions(matrix.scope.metrics),
    metric = metrics[0],
    multiple = metrics.length > 1;
  return (
    <>
      <AllRepositoriesHeading asOf={matrix.source.asOf} />
      <AllRepositoriesTabs active="timeline" summaryHref={summaryHref} timelineHref={href} />
      {controls}
      <TimelineScope request={matrix.request} count={matrix.intervals.length}>
        <span>{metrics.length === 1 ? metricName(metric) : metrics.length + ' metrics'}</span>
        <span>
          {matrix.scope.repositoryIds.length}{' '}
          {matrix.scope.repositoryIds.length === 1 ? 'repository' : 'repositories'} selected
        </span>
        <span>
          {metrics.length === 1 &&
          repositoryTimelineMetricScope(matrix.scope.metrics[0]).family === 'snapshot'
            ? 'Backlog at each covered interval’s end.'
            : multiple
              ? 'Each repository groups the selected metrics; units and cutoff meanings remain separate.'
              : 'Activity within each covered interval.'}
        </span>
      </TimelineScope>
      {!matrix.scope.metrics.length ? (
        <PageState title="No metrics selected">Choose metrics to compare over time.</PageState>
      ) : matrix.rows.length ? (
        <MatrixTable
          key={JSON.stringify([matrix.source, matrix.request, matrix.scope])}
          matrix={matrix}
          interactions={interactions}
        />
      ) : (
        <PageState title="No repositories selected">
          Choose repositories to see their activity over time.
        </PageState>
      )}
    </>
  );
}

function MatrixTable({
  matrix,
  interactions,
}: {
  matrix: RepositoryTimelineMatrix;
  interactions?: MatrixInteractions;
}) {
  const interactive = useClientReady();
  const [page, setPage] = useState(() => repositoryTimelineMatrixWindow(matrix).page);
  const localController = useLocalTableController({
    sort: 'repository',
    descending: false,
    search: '',
    page: 1,
  });
  const controller = interactions?.table ?? localController;
  const windowPage = interactions?.window.page ?? page;
  const periodWindow = useMemo(
    () => repositoryTimelineMatrixWindow(matrix, windowPage),
    [matrix, windowPage],
  );
  const changeWindow = interactions?.window.onChange ?? setPage;
  const sortMetric = interactions?.sortMetric ?? matrix.scope.metrics[0];
  const valueColumns = useMemo(
    () => repositoryTimelineMatrixValues(matrix, sortMetric),
    [matrix, sortMetric],
  );
  const metrics = repositoryTimelineMetricDefinitions(matrix.scope.metrics),
    multiple = metrics.length > 1;
  const definitions = new Map(metrics.map((metric) => [metric.id, metric]));
  const linkable = !!interactions?.detailHref && !interactions.pending;
  const metric = definitions.get(sortMetric)!;
  const rowMetricName = (row: RepositoryTimelineMatrixRow) =>
    metricName(definitions.get(row.metric)!);
  const label = (interval: RepositoryTimelineMatrix['intervals'][number]) =>
    timelineIntervalLabel(interval, matrix.request.grouping);
  const first = periodWindow.intervals[0],
    last = periodWindow.intervals.at(-1)!;
  const windowLabel =
    matrix.request.grouping === 'week'
      ? periodRangeLabel({ ...last.covered, start: first.covered.start })
      : label(first) + (periodWindow.intervals.length > 1 ? ' – ' + label(last) : '');
  const columns: DataColumn<RepositoryTimelineMatrixRow>[] = [
    {
      ...valueColumns[0],
      label: multiple ? 'Repository / metric' : 'Repository',
      pinned: true,
      hideable: false,
      description:
        'Selected metrics stay together under each repository, including known-zero and unavailable values.',
      cell: (row) => {
        const first = row.metric === matrix.scope.metrics[0],
          href = interactions?.repositoryHref(row.repository.slug);
        return (
          <div className={styles.identity}>
            {first ? (
              href ? (
                <Link prefetch={false} className={styles.repository} href={href}>
                  {row.repository.name}
                </Link>
              ) : (
                <strong className={styles.repository}>
                  {row.repository.name}
                  {interactions && (
                    <span className="sr-only">
                      {' '}
                      — no Timeline link: the link would be too large.
                    </span>
                  )}
                </strong>
              )
            ) : (
              <span className="sr-only">{row.repository.name} — </span>
            )}
            {multiple && (
              <span className={styles.metricName} title={definitions.get(row.metric)!.description}>
                {rowMetricName(row)}
                {repositoryTimelineMetricScope(row.metric).family === 'snapshot' ? (
                  <small>At cutoff</small>
                ) : null}
              </span>
            )}
          </div>
        );
      },
    },
    ...periodWindow.intervals.map((interval, offset): DataColumn<RepositoryTimelineMatrixRow> => {
      const index = periodWindow.startIndex + offset;
      return {
        ...valueColumns[index + 1],
        label: label(interval) + (interval.partial ? ' (partial)' : ''),
        width: matrix.request.grouping === 'month' ? 112 : 156,
        align: 'right',
        description:
          timelineIntervalDescription(interval) +
          (interval.partial ? ' Partial calendar period.' : '') +
          ' Sort repositories by ' +
          metricName(metric) +
          '.',
        cell: (row) => (
          <TimelineValueCell
            measurement={row.values[index]}
            unit={repositoryTimelineMetricScope(row.metric).unit}
            name={`${row.repository.name}${multiple ? ', ' + rowMetricName(row) : ''}, ${label(interval)}`}
            href={
              linkable && row.values[index].value !== null
                ? interactions.detailHref!(row, interval.id)
                : null
            }
            linkable={linkable}
          />
        ),
      };
    }),
  ];
  const sortedInterval = matrix.intervals.find((interval) => interval.id === controller.query.sort);
  const outsideWindow =
    sortedInterval && !periodWindow.intervals.some((interval) => interval.id === sortedInterval.id);
  const incomplete = matrix.rows.some((row) => row.values.some(isIncompleteValue));
  const intervalIndex = new Map(matrix.intervals.map((interval, index) => [interval.id, index]));
  const unlinked =
    !!interactions &&
    !interactions.pending &&
    (matrix.rows.some(
      (row) =>
        row.metric === matrix.scope.metrics[0] &&
        interactions.repositoryHref(row.repository.slug) === null,
    ) ||
      (linkable &&
        hasUnlinkedValue(
          matrix.rows,
          periodWindow.intervals.map((interval) => interval.id),
          (row, interval) => row.values[intervalIndex.get(interval)!],
          (row, interval) => interactions.detailHref!(row, interval),
        )));
  return (
    <div className={timelineStyles.stack}>
      {incomplete && <TimelineCoverageNotice />}
      {unlinked && <TimelineLinkLimitNotice />}
      <DataTable
        disabled={interactions?.pending}
        title={multiple ? 'Repository metrics' : metricName(metric)}
        rows={matrix.rows}
        rowClassName={(row) =>
          multiple && row.metric === matrix.scope.metrics.at(-1) ? styles.groupEnd : undefined
        }
        pageSize={
          Math.floor(tablePageSize / matrix.scope.metrics.length) * matrix.scope.metrics.length
        }
        columns={columns}
        valueColumns={valueColumns}
        controller={controller}
        searchable={false}
        showColumnMenu={false}
        controls={interactions?.exportControl}
        showSinglePageControls={false}
        itemLabel={
          multiple
            ? { singular: 'metric row', plural: 'metric rows' }
            : { singular: 'repository', plural: 'repositories' }
        }
        description={
          <span>
            {multiple
              ? 'One row per metric. Repository groups stay together across pages.'
              : metric.description}
          </span>
        }
        headerContent={
          <div className={styles.window}>
            <div className={styles.windowLabel} role="status" aria-live="polite">
              <strong>{windowLabel}</strong>
              <span>
                Periods {periodWindow.startIndex + 1}–{periodWindow.endIndex} of{' '}
                {matrix.intervals.length} · Window {periodWindow.page} of {periodWindow.pageCount}
              </span>
            </div>
            <nav className={styles.windowActions} aria-label="Timeline period windows">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !interactive || interactions?.pending || periodWindow.earlierPage === null
                }
                onClick={() => changeWindow(periodWindow.earlierPage!)}
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Earlier
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!interactive || interactions?.pending || periodWindow.laterPage === null}
                onClick={() => changeWindow(periodWindow.laterPage!)}
              >
                Later
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </nav>
          </div>
        }
        footerNote={
          <span>
            {timelineFooterLegend}
            {sortedInterval && (
              <>
                <br />
                Sorted by {label(sortedInterval)}
                {multiple ? ' · ' + metricName(metric) : ''} (
                {controller.query.descending ? 'descending' : 'ascending'}
                {outsideWindow ? '; outside visible periods' : ''}).
              </>
            )}
          </span>
        }
      />
    </div>
  );
}
