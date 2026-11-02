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
import { repositoryTimelineReturnTo } from '@/lib/presentation/timeline-navigation';
import { repositoryTimelineMetricDefinitions } from './repository-timeline-columns';
import styles from '@/components/reporting/timeline-layout.module.css';
import type { TimelineTableControls } from '@/components/reporting/timeline-table';
import type { TimelineChartControls } from '@/components/charts/timeline-chart';

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
  return (
    <>
      <RepositoryHeader
        repository={report.scope.repository}
        asOf={report.source.asOf}
        returnTo={repositoryTimelineReturnTo(parent)}
        navigation={navigation}
        activeKind="timeline"
        timelineHref={href}
        parentLink={
          parent
            ? {
                href: parent,
                label: parent.startsWith('/repos?')
                  ? 'Repository timeline'
                  : 'Previous repository view',
              }
            : undefined
        }
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
        />
        <TimelineTable
          rows={report.rows}
          metrics={metrics}
          grouping={report.request.grouping}
          title={snapshot ? 'Backlog over time' : 'Activity over time'}
          controls={tableControls}
        />
      </div>
    </>
  );
}
