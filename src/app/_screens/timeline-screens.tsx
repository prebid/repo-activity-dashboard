'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CsvExportDialog } from '@/components/exports/csv-export-dialog';
import { timelineCsvDownload } from '@/components/reporting/timeline-csv-download';
import { timelineSupportHref } from '@/lib/presentation/timeline-support-query';
import { useTimelineControls } from '@/lib/navigation/use-timeline-controls';
import { TimelineControls } from '@/components/reporting/timeline-controls';
import { RepositorySelector } from '@/components/reporting/repository-selector';
import { ContributionControls } from '@/features/contributions/contribution-controls';
import { contributionOptionsClient } from '@/features/contributions/contribution-options-client';
import { RepositoryTimelineView } from '@/features/repositories/repository-timeline-view';
import { RepositoryTimelineMatrixView } from '@/features/repositories/repository-timeline-matrix-view';
import {
  ContributionTimelineView,
  contributionTimelineMetrics,
} from '@/features/contributions/contribution-timeline-view';
import { repositoryTimelineMetricDefinitions } from '@/features/repositories/repository-timeline-columns';
import { TimelineRepositoryFilters } from '@/features/repositories/timeline-repository-filters';
import { repositoryTimelineMetricIds, type RepositoryTimeline } from '@/models/repository-timeline';
import type { RepositoryTimelineMatrix } from '@/models/repository-timeline-matrix';
import type { ContributionTimeline } from '@/models/contribution-timeline';
import type { ContributionArea, ContributionSampleScenario } from '@/models/contribution-page';
import type { RepositoryFilterOptions, RepositoryPageNavigation } from '@/models/repository-page';
import type { TimelineControlContext } from '@/models/timeline-controls';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import { matrixRepositoryTimelineHref } from '@/lib/presentation/timeline-navigation';
import styles from '@/components/reporting/timeline-layout.module.css';

const defaults = (metrics: TimelineMetricDefinition[]) =>
  Object.fromEntries(metrics.map((metric) => [metric.id, metric.defaultVisible]));
type Shared = { viewerId: string; context: TimelineControlContext };
export function RepositoryTimelineMatrixScreen({
  viewerId,
  context,
  matrix,
  summaryHref,
}: Shared & { matrix: RepositoryTimelineMatrix; summaryHref: string }) {
  const control = useTimelineControls(viewerId, context, {});
  const matrixMetrics = repositoryTimelineMetricDefinitions(matrix.scope.metrics);
  const csv = timelineCsvDownload(control.href, matrix.source);
  return (
    <RepositoryTimelineMatrixView
      matrix={matrix}
      href={control.href}
      summaryHref={summaryHref}
      controls={
        <TimelineControls
          context={context}
          {...control}
          metrics={repositoryTimelineMetricDefinitions(repositoryTimelineMetricIds)}
          onView={control.changeView}
          onPeriod={control.changePeriod}
          onReset={control.reset}
        >
          <RepositorySelector
            description="Choose repositories for this timeline."
            repositories={context.repositories}
            selected={context.repositoryIds!}
            onApply={control.changeRepositories}
          />
        </TimelineControls>
      }
      interactions={{
        pending: control.pending,
        sortMetric: control.view.metric as (typeof matrix.scope.metrics)[number],
        table: control.table,
        window: { page: control.view.window, onChange: (window) => control.changeView({ window }) },
        repositoryHref: (slug) =>
          matrixRepositoryTimelineHref({ ...context, view: control.view }, slug, control.href),
        detailHref: (id, interval) => {
          if (control.pending) return null;
          const row = matrix.rows.find((row) => row.id === id)!;
          const href = matrixRepositoryTimelineHref(
            { ...context, view: control.view },
            row.repository.slug,
            control.href,
            row.metric,
          );
          return href
            ? timelineSupportHref(href, matrix.source, row.metric, interval, 'matrix')
            : null;
        },
        exportControl: (
          <CsvExportDialog
            title="Repository timeline"
            description="Export one row per selected repository and period across the full range, beyond the visible period window and repository page. Selected metrics, dates, filters, units and data coverage are included."
            columns={[
              { id: 'repository', label: 'Repository', selectionGroup: 'Identity', required: true },
              { id: 'period', label: 'Period', selectionGroup: 'Identity', required: true },
              ...matrixMetrics,
            ]}
            visibleColumnIds={['repository', 'period', ...matrix.scope.metrics]}
            contextKey={JSON.stringify([control.href, matrix.source])}
            onDownload={(selection) => csv({ ...selection, query: control.table.flushSearch() })}
          />
        ),
      }}
    />
  );
}
export function RepositoryTimelineScreen({
  viewerId,
  context,
  report,
  navigation,
  parent,
  facets,
  omitted,
}: Shared & {
  report: RepositoryTimeline;
  navigation: RepositoryPageNavigation;
  parent: string | null;
  facets: RepositoryFilterOptions;
  omitted: boolean;
}) {
  const metrics = repositoryTimelineMetricDefinitions(report.metrics);
  const control = useTimelineControls(viewerId, context, defaults(metrics));
  const router = useRouter();
  const detailHref = (metric: string, interval: string) =>
    control.pending ? null : timelineSupportHref(control.href, report.source, metric, interval);
  return (
    <RepositoryTimelineView
      report={report}
      navigation={navigation}
      href={control.href}
      parent={parent}
      controls={
        <div className={styles.stack}>
          {omitted && (
            <aside className={styles.notice}>
              Current backlog constraints remain on the original list. Activity over time preserves
              compatible metadata filters; choose Backlog at cutoff for historical age or review
              filters.
            </aside>
          )}
          <TimelineControls
            context={context}
            {...control}
            metrics={metrics}
            onView={control.changeView}
            onPeriod={control.changePeriod}
            onReset={control.reset}
          >
            <TimelineRepositoryFilters
              key={JSON.stringify([context.filters, context.view.family])}
              filters={context.filters!}
              facets={facets}
              snapshot={control.view.family === 'snapshot'}
              onChange={control.changeFilters}
            />
          </TimelineControls>
        </div>
      }
      tableControls={{
        controller: control.table,
        visibility: control.visibility,
        disabled: control.pending,
        detailHref,
        csvDownload: timelineCsvDownload(control.href, report.source),
        exportContextKey: JSON.stringify([control.href, report.source]),
      }}
      chartControls={{
        disabled: control.pending,
        onInterval: (metric, interval) => {
          const href = detailHref(metric, interval);
          if (href) router.push(href);
        },
        visible: control.view.chart,
        metric: control.view.metric,
        onVisibility: (chart) => control.changeView({ chart }),
        onMetric: (metric) => control.changeView({ metric }),
      }}
    />
  );
}
export function ContributionTimelineScreen({
  viewerId,
  context,
  report,
  area,
  reportHref,
}: Shared & { report: ContributionTimeline; area: ContributionArea; reportHref: string }) {
  const sample = context.sample.split(':')[0] as ContributionSampleScenario;
  const options = useMemo(() => contributionOptionsClient(sample), [sample]);
  const control = useTimelineControls(
    viewerId,
    context,
    defaults(contributionTimelineMetrics),
    options,
  );
  return (
    <ContributionTimelineView
      report={report}
      area={area}
      href={control.href}
      reportHref={reportHref}
      controls={
        <div className={styles.stack}>
          <ContributionControls
            directory={{ repositories: context.repositories }}
            options={options}
            value={context.contribution!}
            asOf={context.asOf}
            pending={control.pending}
            storageAvailable={control.storageAvailable}
            onChange={control.changeContribution}
            onReset={control.resetContribution}
          />
          <TimelineControls
            context={context}
            {...control}
            metrics={contributionTimelineMetrics}
            showPreferenceNote={false}
            onView={control.changeView}
            onPeriod={control.changePeriod}
            onReset={control.reset}
          />
        </div>
      }
      tableControls={{
        controller: control.table,
        visibility: control.visibility,
        disabled: control.pending,
        detailHref: (metric, interval) =>
          control.pending
            ? null
            : timelineSupportHref(control.href, report.source, metric, interval),
        csvDownload: timelineCsvDownload(control.href, report.source),
        exportContextKey: JSON.stringify([control.href, report.source]),
      }}
    />
  );
}
