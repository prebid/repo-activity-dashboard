'use client';
import { useMemo } from 'react';
import type { RepositoryTimeline } from '@/models/repository-timeline';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { TimelineTable } from '@/components/reporting/timeline-table';
import {
  noReportControls,
  ReportToolbar,
  type ReportToolbarControls,
} from '@/components/reporting/report-toolbar';
import { zonedRangeLabel } from '@/lib/presentation/overview-periods';
import { countLabel } from '@/lib/presentation/format';
import { TimelineChart } from '@/components/charts/timeline-chart';
import { RepositoryHeader } from './repository-header';
import { summaryReturnTo } from '@/lib/presentation/repository-drilldown';
import { resolveBack, viewOf } from '@/lib/presentation/url/back';
import { repositoryTimelineMetricDefinitions } from './repository-timeline-columns';
import styles from '@/components/reporting/timeline-layout.module.css';
import type { TimelineTableControls } from '@/components/reporting/timeline-table';
import type { TimelineChartControls } from '@/components/charts/timeline-chart';

/**
 * The Summary a repository Timeline returns to through the page it was opened from: a repository
 * list, insight or author page names its own Summary; a matrix parent's Summary is its own parent.
 * `/repos` when the Timeline names no parent (the crumb opens the viewer's saved Summary, as the
 * masthead does), null when the parent cannot be restored.
 */
function parentSummary(parent: string | null | undefined): string | null {
  if (parent === undefined) return '/repos';
  const view = parent === null ? null : viewOf(parent);
  if (!view) return null;
  if (view.route !== '/repos') return summaryReturnTo(view);
  if (view.values.back === undefined && view.values.repo === undefined) return '/repos';
  const [summary] = resolveBack(view);
  return summary?.available ? summary.href : null;
}
export function RepositoryTimelineView({
  report,
  navigation,
  href,
  toolbar = noReportControls,
  scopeNotice,
  tableControls,
  chartControls,
  parent,
}: {
  report: RepositoryTimeline;
  navigation: RepositoryPageNavigation;
  href: string;
  /** The Timeline's controls; the view adds its scope summary. */
  toolbar?: ReportToolbarControls;
  /** A note about the scope carried over from the list, shown above the toolbar. */
  scopeNotice?: React.ReactNode;
  tableControls?: TimelineTableControls;
  chartControls?: TimelineChartControls;
  parent?: string | null;
}) {
  const metrics = useMemo(
      () => repositoryTimelineMetricDefinitions(report.metrics),
      [report.metrics],
    ),
    snapshot = report.scope.family === 'snapshot';
  const key = JSON.stringify([report.source, report.request, report.scope]);
  const tableTitle = snapshot ? 'Backlog over time' : 'Activity over time';
  return (
    <>
      <RepositoryHeader
        repository={report.scope.repository}
        asOf={report.source.asOf}
        returnTo={parentSummary(parent)}
        navigation={navigation}
        activeKind="timeline"
        timelineHref={href}
        parentLink={
          parent === undefined
            ? undefined
            : {
                href: parent,
                label: parent?.startsWith('/repos?')
                  ? 'Repository timeline'
                  : 'Previous repository view',
              }
        }
        sections={[
          { id: 'trend', label: 'Trend' },
          { id: 'over-time', label: tableTitle },
        ]}
      />
      {scopeNotice}
      <ReportToolbar
        label="Timeline scope"
        {...toolbar}
        summary={{
          lead: zonedRangeLabel(report.request.range),
          facts: [
            report.rows.length +
              ' ' +
              countLabel(report.rows.length, { singular: 'interval', plural: 'intervals' }),
            'Primary branch: ' + report.scope.repository.primaryBranch,
            snapshot
              ? 'Values are states at each covered interval’s end.'
              : 'Values use each metric’s event date.',
          ],
        }}
      />
      <div className={styles.stack} key={key}>
        <TimelineChart
          rows={report.rows}
          metrics={metrics}
          summary={report.summary}
          grouping={report.request.grouping}
          snapshot={snapshot}
          controls={chartControls}
          anchor="trend"
        />
        <TimelineTable
          rows={report.rows}
          metrics={metrics}
          grouping={report.request.grouping}
          title={tableTitle}
          controls={tableControls}
          anchor="over-time"
        />
      </div>
    </>
  );
}
