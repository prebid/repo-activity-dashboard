'use client';
import Link from 'next/link';
import { Table2, CalendarDays } from 'lucide-react';
import type { ContributionTimeline } from '@/models/contribution-timeline';
import type { ContributionArea } from '@/models/contribution-page';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import { isCoreMetric, type ReportMetric } from '@/models/contribution-metrics';
import { contributionActorTypes } from '@/models/contributions';
import { contributionMetricValues } from '@/lib/presentation/contribution-table-values';
import { accountTypeLabels } from '@/models/github-account';
import { GitHubAccountLink } from '@/components/github/account-link';
import { TimelineTable } from '@/components/reporting/timeline-table';
import { TimelineScope } from '@/components/reporting/timeline-scope';
import { PageState } from '@/components/feedback/page-state';
import { ContributionHeading } from './contribution-header';
import styles from './contributions.module.css';
import timelineStyles from '@/components/reporting/timeline-layout.module.css';

export const contributionTimelineMetrics: TimelineMetricDefinition[] =
  contributionMetricValues().map(
    ({ id, label, group, description, selectionGroup, selectionSection }) => ({
      id,
      label,
      group,
      description,
      selectionGroup,
      selectionSection,
      unit: 'count',
      defaultVisible: isCoreMetric(id as ReportMetric),
    }),
  );
export function ContributionTimelineView({
  report,
  area,
  reportHref,
  href,
  controls,
  tableControls,
}: {
  report: ContributionTimeline;
  area: ContributionArea;
  reportHref: string;
  href: string;
  controls?: React.ReactNode;
  tableControls?: import('@/components/reporting/timeline-table').TimelineTableControls;
}) {
  const { subject, focus, selection, includedAccountCount } = report.scope;
  const title =
    focus.kind === 'overview'
      ? area === 'contributors'
        ? 'Contributors'
        : 'Companies'
      : (subject?.name ?? 'Unmapped company');
  const empty = !selection.repositoryIds.length
    ? 'No repositories selected'
    : !selection.actorTypes.length
      ? 'No account types selected'
      : !includedAccountCount
        ? 'No accounts match this report'
        : null;
  return (
    <>
      <ContributionHeading
        title={title}
        asOf={report.source.asOf}
        eyebrow={
          focus.kind === 'overview'
            ? 'Contribution activity'
            : focus.kind === 'company'
              ? 'Company report'
              : 'Contributor report'
        }
      >
        {subject && 'login' in subject ? (
          <div className={styles.meta}>
            <GitHubAccountLink
              login={subject.login}
              url={subject.profileUrl}
              label={'@' + subject.login}
            />
            <span>{accountTypeLabels[subject.actorType]}</span>
          </div>
        ) : (
          <p className={styles.subtitle}>
            {focus.kind === 'overview'
              ? 'Contribution activity across your selected population.'
              : 'Contribution activity for this ' +
                (focus.kind === 'company' ? 'company.' : 'account.')}
          </p>
        )}
      </ContributionHeading>
      <nav className={timelineStyles.tabs} aria-label="Report view">
        <Link prefetch={false} href={reportHref}>
          <Table2 size={16} aria-hidden="true" />
          Report
        </Link>
        <Link prefetch={false} href={href} aria-current="page">
          <CalendarDays size={16} aria-hidden="true" />
          Over time
        </Link>
      </nav>
      {controls}
      <TimelineScope request={report.request} count={report.rows.length}>
        <span>{selection.repositoryIds.length} repositories</span>
        <span>
          {selection.actorTypes.length === contributionActorTypes.length
            ? 'All account types'
            : selection.actorTypes.map((type) => accountTypeLabels[type]).join(', ') ||
              'No account types'}
        </span>
        <span>
          {includedAccountCount} included {includedAccountCount === 1 ? 'account' : 'accounts'}
        </span>
        <span>Company attribution: current mapping</span>
        {selection.excludedAccountIds.length > 0 && (
          <span>{selection.excludedAccountIds.length} excluded</span>
        )}
      </TimelineScope>
      {empty ? (
        <PageState title={empty}>
          Choose repositories and accounts to see their activity over time.
        </PageState>
      ) : (
        <TimelineTable
          key={JSON.stringify([report.source, report.request, report.scope])}
          rows={report.rows}
          metrics={contributionTimelineMetrics}
          grouping={report.request.grouping}
          title="Contributions over time"
          controls={tableControls}
        />
      )}
    </>
  );
}
