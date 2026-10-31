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
import { MeasurementValue } from '@/components/metrics/measurement-value';
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
import { formatCount } from '@/lib/presentation/format';
import { contributionLinkLimitMessage } from '@/lib/presentation/contribution-return';
export interface MatrixInteractions {
  sortMetric?: RepositoryTimelineMetric;
  detailHref?: (repositoryId: string, interval: string) => string | null;
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
        <span>
          {metrics.length === 1 ? metric.group + ' · ' + metric.label : metrics.length + ' metrics'}
        </span>
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
  const window = repositoryTimelineMatrixWindow(matrix, interactions?.window.page ?? page);
  const changeWindow = interactions?.window.onChange ?? setPage;
  const sortMetric = interactions?.sortMetric ?? matrix.scope.metrics[0];
  const valueColumns = useMemo(
    () => repositoryTimelineMatrixValues(matrix, sortMetric),
    [matrix, sortMetric],
  );
  const metrics = repositoryTimelineMetricDefinitions(matrix.scope.metrics),
    multiple = metrics.length > 1;
  const definitions = new Map(metrics.map((metric) => [metric.id, metric]));
  const metric = definitions.get(sortMetric)!;
  const statistic = (row: RepositoryTimelineMatrixRow) => {
    const definition = definitions.get(row.metric)!;
    return definition.group + ' — ' + definition.label;
  };
  const label = (interval: RepositoryTimelineMatrix['intervals'][number]) =>
    timelineIntervalLabel(interval, matrix.request.grouping);
  const first = window.intervals[0],
    last = window.intervals.at(-1)!;
  const windowLabel =
    matrix.request.grouping === 'week'
      ? periodRangeLabel({ ...last.covered, start: first.covered.start })
      : label(first) + (window.intervals.length > 1 ? ' – ' + label(last) : '');
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
                <strong className={styles.repository}>{row.repository.name}</strong>
              )
            ) : (
              <span className="sr-only">{row.repository.name} — </span>
            )}
            {multiple && (
              <span className={styles.statistic} title={definitions.get(row.metric)!.description}>
                {statistic(row)}
                {repositoryTimelineMetricScope(row.metric).family === 'snapshot' ? (
                  <small>At cutoff</small>
                ) : null}
              </span>
            )}
          </div>
        );
      },
    },
    ...window.intervals.map((interval, offset): DataColumn<RepositoryTimelineMatrixRow> => {
      const index = window.startIndex + offset;
      return {
        ...valueColumns[index + 1],
        label: label(interval) + (interval.partial ? ' (partial)' : ''),
        width: matrix.request.grouping === 'month' ? 112 : 156,
        align: 'right',
        description:
          timelineIntervalDescription(interval) +
          (interval.partial ? ' Partial calendar period.' : '') +
          ' Sort repositories by ' +
          metric.group +
          ' — ' +
          metric.label +
          '.',
        cell: (row) => {
          const value = (
            <MeasurementValue
              measurement={row.values[index]}
              unit={repositoryTimelineMetricScope(row.metric).unit}
            />
          );
          const href =
            row.values[index].value !== null
              ? interactions?.detailHref?.(row.id, interval.id)
              : null;
          return href ? (
            <Link
              prefetch={false}
              href={href}
              className={timelineStyles.valueLink}
              aria-label={`${row.repository.name}${multiple ? ', ' + statistic(row) : ''}, ${label(interval)}: ${formatCount(row.values[index].value)}${repositoryTimelineMetricScope(row.metric).unit === 'days' ? ' d' : ''}`}
            >
              {value}
            </Link>
          ) : (
            <span
              title={
                interactions?.detailHref &&
                !interactions.pending &&
                row.values[index].value !== null
                  ? contributionLinkLimitMessage
                  : undefined
              }
            >
              {value}
            </span>
          );
        },
      };
    }),
  ];
  const sortedInterval = matrix.intervals.find((interval) => interval.id === controller.query.sort);
  const outsideWindow =
    sortedInterval && !window.intervals.some((interval) => interval.id === sortedInterval.id);
  const incomplete = matrix.rows.some((row) =>
    row.values.some((value) => value.status === 'partial' || value.status === 'missing'),
  );
  return (
    <div className={timelineStyles.stack}>
      {incomplete && (
        <aside className={timelineStyles.notice} aria-label="Timeline data coverage">
          <strong>Some timeline values are incomplete or unavailable.</strong> Dashes keep missing
          values distinct from zero; an asterisk marks incomplete data. A partial period describes
          the covered dates.
        </aside>
      )}
      <DataTable
        disabled={interactions?.pending}
        title={multiple ? 'Repository metrics' : `${metric.group} · ${metric.label}`}
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
                Periods {window.startIndex + 1}–{window.endIndex} of {matrix.intervals.length} ·
                Window {window.page} of {window.pageCount}
              </span>
            </div>
            <nav className={styles.windowActions} aria-label="Timeline period windows">
              <Button
                size="sm"
                variant="outline"
                disabled={!interactive || interactions?.pending || window.earlierPage === null}
                onClick={() => changeWindow(window.earlierPage!)}
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Earlier
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!interactive || interactions?.pending || window.laterPage === null}
                onClick={() => changeWindow(window.laterPage!)}
              >
                Later
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </nav>
          </div>
        }
        footerNote={
          <span>
            UTC · — unavailable or not applicable · * incomplete value
            {sortedInterval && (
              <>
                <br />
                Sorted by {label(sortedInterval)}
                {multiple ? ' · ' + metric.group + ' — ' + metric.label : ''} (
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
