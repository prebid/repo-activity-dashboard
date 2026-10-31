import type { ReactNode } from 'react';
import { PageState } from '@/components/feedback/page-state';
import { RepositoryHeader } from './repository-header';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import type { OverviewRepository } from '@/models/repository-overview';
import type { Count } from '@/models/reporting-measurement';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import styles from './repository-records.module.css';

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
}: {
  context: { repository: OverviewRepository; asOf: string; drilldown: RepositoryDrilldown };
  title: string;
  measurement: Count;
  summary: ReactNode;
  children: ReactNode;
  parentLink?: { href: string; label: string };
  navigation?: RepositoryPageNavigation;
  timelineHref?: string | null;
  onTimeline?: React.MouseEventHandler<HTMLAnchorElement>;
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
      />
      <p className={styles.supportingTitle}>{title}</p>
      <div className={styles.scope} aria-label="Selected repository scope" role="region">
        <span>{period ? periodRangeLabel(selection.range) + ' · UTC' : 'Current open items'}</span>
        {period && selection.branch && <span>Primary branch: {selection.branch}</span>}
        {!period && !['totalOpenPrs', 'draftPrs', 'openIssues'].includes(selection.metric) && (
          <span>Excludes drafts</span>
        )}
        {measurement.value === null ? <span>Sample records unavailable</span> : summary}
      </div>
      {measurement.status === 'partial' && (
        <p role="status" className={styles.notice}>
          Partial sample coverage: {measurement.reason} This list contains the available entries
          only.
        </p>
      )}
      {measurement.value === null ? (
        <PageState title="Sample records unavailable">{measurement.reason}</PageState>
      ) : (
        children
      )}
    </>
  );
}
