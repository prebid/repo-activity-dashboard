'use client';
import type { RepositoryTimeline } from '@/models/repository-timeline';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { TimelineTable } from '@/components/reporting/timeline-table';
import { TimelineScope } from '@/components/reporting/timeline-scope';
import { TimelineChart } from '@/components/charts/timeline-chart';
import { RepositoryHeader } from './repository-header';
import { repositoryTimelineMetricDefinitions } from './repository-timeline-columns';
import styles from '@/components/reporting/timeline-layout.module.css';
import type { TimelineTableControls } from '@/components/reporting/timeline-table';
import type { TimelineChartControls } from '@/components/charts/timeline-chart';

export function RepositoryTimelineView({
  report,
  navigation,
  href,
  controls,
  tableControls,
  chartControls,
  parent,
}: {
  report: RepositoryTimeline;
  navigation: RepositoryPageNavigation;
  href: string;
  controls?: React.ReactNode;
  tableControls?: TimelineTableControls;
  chartControls?: TimelineChartControls;
  parent?: string | null;
}) {
  const metrics = repositoryTimelineMetricDefinitions(report.metrics),
    snapshot = report.scope.family === 'snapshot';
  const key = JSON.stringify([report.source, report.request, report.scope]);
  return (
    <>
      <RepositoryHeader
        repository={report.scope.repository}
        asOf={report.source.asOf}
        returnTo="/repos"
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
      {controls}
      <TimelineScope request={report.request} count={report.rows.length}>
        <span>
          {report.scope.recordKind === 'prs' ? 'Pull requests' : 'Issues'} ·{' '}
          {snapshot ? 'Backlog at cutoff' : 'Period activity'}
        </span>
        <span>Primary branch: {report.scope.repository.primaryBranch}</span>
        <span>
          {snapshot
            ? 'Values are states at each covered interval’s end.'
            : 'Values use each metric’s event date.'}
        </span>
      </TimelineScope>
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
