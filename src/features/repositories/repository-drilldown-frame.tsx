import type { ReactNode } from 'react';
import { Callout } from '@/components/feedback/callout';
import { EmptyState } from '@/components/feedback/empty-state';
import { noReportControls, ReportToolbar } from '@/components/reporting/report-toolbar';
import { RepositoryHeader } from './repository-header';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { zonedRangeLabel } from '@/lib/presentation/overview-periods';
import type { OverviewRepository } from '@/models/repository-overview';
import type { Count } from '@/models/reporting-measurement';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';

export function RepositoryDrilldownFrame({
  context,
  title,
  measurement,
  summary,
  children,
  parentLink,
  navigation,
  timelineHref,
  onTimeline,
  timelinePending,
}: {
  context: { repository: OverviewRepository; asOf: string; drilldown: RepositoryDrilldown };
  title: string;
  measurement: Count;
  /** Facts for the scope summary after the range, one per item. */
  summary: readonly ReactNode[];
  children: ReactNode;
  parentLink?: { href: string; label: string };
  navigation?: RepositoryPageNavigation;
  timelineHref?: string | null;
  onTimeline?: React.MouseEventHandler<HTMLAnchorElement>;
  timelinePending?: boolean;
}) {
  const { repository, asOf, drilldown } = context,
    selection = drilldown.selection;
  const period = selection.scope === 'period';
  return (
    <>
      <RepositoryHeader
        repository={repository}
        asOf={asOf}
        returnTo={drilldown.returnTo}
        parentLink={parentLink}
        navigation={navigation}
        timelineHref={timelineHref}
        onTimeline={onTimeline}
        timelinePending={timelinePending}
      />
      <ReportToolbar
        label="Selected repository scope"
        {...noReportControls}
        summary={{
          lead: title,
          facts: [
            period ? zonedRangeLabel(selection.range) : 'Current open items',
            ...(period && selection.branch ? ['Primary branch: ' + selection.branch] : []),
            ...(!period && !['totalOpenPrs', 'draftPrs', 'openIssues'].includes(selection.metric)
              ? ['Excludes drafts']
              : []),
            ...(measurement.value === null ? ['Sample records unavailable'] : summary),
          ],
        }}
      />
      {measurement.status === 'partial' && (
        <Callout tone="warning" as="p" role="status">
          Partial sample coverage: {measurement.reason} This list contains the available entries
          only.
        </Callout>
      )}
      {measurement.value === null ? (
        <EmptyState kind="missing" title="Sample records unavailable">
          {measurement.reason}
        </EmptyState>
      ) : (
        children
      )}
    </>
  );
}
