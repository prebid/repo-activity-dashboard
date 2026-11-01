'use client';
import type { ContributionTimeline } from '@/models/contribution-timeline';
import type { ContributionArea } from '@/models/contribution-page';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import { isCoreMetric, type ReportMetric } from '@/models/contribution-metrics';
import { contributionMetricValues } from '@/lib/presentation/contribution-table-values';
import { contributionSubjectTitle } from '@/lib/presentation/page-title';
import { accountTypeLabels } from '@/models/github-account';
import { GitHubAccountLink } from '@/components/github/account-link';
import { TimelineTable } from '@/components/reporting/timeline-table';
import {
  noReportControls,
  ReportToolbar,
  type ReportToolbarControls,
} from '@/components/reporting/report-toolbar';
import { zonedRangeLabel } from '@/lib/presentation/overview-periods';
import { countLabel } from '@/lib/presentation/format';
import { EmptyState } from '@/components/feedback/empty-state';
import {
  accountTypesFact,
  ContributionHeading,
  ContributionReportViewTabs,
  ContributionSubjectAvatar,
} from './contribution-header';
import styles from './contributions.module.css';

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
  toolbar = noReportControls,
  tableControls,
}: {
  report: ContributionTimeline;
  area: ContributionArea;
  reportHref: string;
  href: string;
  /** The report filters and Timeline settings; the view adds its scope summary. */
  toolbar?: ReportToolbarControls;
  tableControls?: import('@/components/reporting/timeline-table').TimelineTableControls;
}) {
  const { subject, focus, selection, includedAccountCount } = report.scope;
  const title = contributionSubjectTitle(area, focus.kind === 'overview' ? 'overview' : subject);
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
        identity={
          focus.kind === 'company' ? (
            <ContributionSubjectAvatar subject={{ kind: 'company', company: subject }} />
          ) : subject && 'login' in subject ? (
            <ContributionSubjectAvatar subject={{ kind: 'contributor', account: subject }} />
          ) : undefined
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
      <ContributionReportViewTabs active="timeline" reportHref={reportHref} timelineHref={href} />
      <ReportToolbar
        label="Timeline scope"
        {...toolbar}
        summary={{
          lead: zonedRangeLabel(report.request.range),
          facts: [
            report.rows.length +
              ' ' +
              countLabel(report.rows.length, { singular: 'interval', plural: 'intervals' }),
            ...accountTypesFact(selection.actorTypes),
            includedAccountCount +
              ' ' +
              countLabel(includedAccountCount, {
                singular: 'included account',
                plural: 'included accounts',
              }),
            'Company attribution: current mapping',
          ],
        }}
      />
      {empty ? (
        <EmptyState
          kind={
            selection.repositoryIds.length && selection.actorTypes.length ? 'no-match' : 'empty'
          }
          title={empty}
        >
          Choose repositories and accounts to see their activity over time.
        </EmptyState>
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
