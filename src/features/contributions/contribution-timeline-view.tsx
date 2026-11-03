'use client';
import type { ContributionTimeline } from '@/models/contribution-timeline';
import type { ContributionArea } from '@/models/contribution-page';
import { contributionLenses, type ContributionLens } from '@/models/contribution-lens';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import { contributionMetricValues } from '@/lib/presentation/contribution-table-values';
import { contributionTimelineColumnTable } from '@/lib/presentation/url/defaults';
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
import { ViewBar } from '@/components/navigation/view-bar';
import {
  accountTypesFact,
  companyReportMeta,
  ContributionAreaTabs,
  ContributionHeading,
  ContributionReportViewTabs,
  ContributionSubjectAvatar,
} from './contribution-header';
import { ContributionNavigationLink, coreMetricHeading } from './contribution-columns';
import { companyAttributionLabels } from '@/models/contributions';

/**
 * The links an Over time view takes from its screen, which derives them from the current URL.
 * Without them the view shows no Back to report link, area tabs or company link.
 */
export interface ContributionTimelineNavigation {
  /** On a contributor or company report, the report the crumb opens. */
  returnTo?: string | null;
  /** That crumb's label: the parent overview's name, else "Back to report" (absent). */
  returnLabel?: string;
  /** On an overview, each area's Over time; null when its URL does not fit. */
  areas?: Record<ContributionArea, string | null>;
  /** On a contributor report, the company's report; null when its URL does not fit. */
  company?: string | null;
}

/**
 * The Over time metric columns in each lens: every report metric, with the lens's three shown by
 * default (decisions C5 and D22); the rest are in Columns. Core metrics carry the report table's
 * display-only headings.
 */
export const contributionTimelineMetrics: Readonly<
  Record<ContributionLens, TimelineMetricDefinition[]>
> = Object.fromEntries(
  contributionLenses.map((lens) => [
    lens,
    contributionMetricValues().map(
      ({ id, label, group, description, selectionGroup, selectionSection }) => ({
        id,
        label,
        group,
        displayGroup: coreMetricHeading(id),
        description,
        selectionGroup,
        selectionSection,
        unit: 'count' as const,
        defaultVisible: contributionTimelineColumnTable(lens).visible.has(id),
      }),
    ),
  ]),
) as Record<ContributionLens, TimelineMetricDefinition[]>;
export function ContributionTimelineView({
  report,
  area,
  reportHref,
  href,
  toolbar = noReportControls,
  tableControls,
  navigation = {},
  lens = 'contributors',
}: {
  report: ContributionTimeline;
  area: ContributionArea;
  reportHref: string;
  href: string;
  /** The report filters and Timeline settings; the view adds its scope summary. */
  toolbar?: ReportToolbarControls;
  tableControls?: import('@/components/reporting/timeline-table').TimelineTableControls;
  navigation?: ContributionTimelineNavigation;
  /** The lens the Over time view is read in: its title, people tab and default columns. */
  lens?: ContributionLens;
}) {
  const { subject, focus, selection, includedAccountCount } = report.scope;
  const company = report.scope.company?.name ?? 'Unmapped company';
  const title = contributionSubjectTitle(
    area,
    focus.kind === 'overview' ? 'overview' : subject,
    lens,
  );
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
        source={{
          source: report.source.source,
          companyAttribution: report.scope.companyAttribution,
        }}
        returnTo={focus.kind === 'overview' ? undefined : navigation.returnTo}
        returnLabel={navigation.returnLabel}
        identity={
          focus.kind === 'company' ? (
            <ContributionSubjectAvatar subject={{ kind: 'company', company: subject }} />
          ) : subject && 'login' in subject ? (
            <ContributionSubjectAvatar subject={{ kind: 'contributor', account: subject }} />
          ) : undefined
        }
      >
        {subject && 'login' in subject ? (
          <>
            <GitHubAccountLink
              login={subject.login}
              url={subject.profileUrl}
              label={'@' + subject.login}
            />
            <span>{accountTypeLabels[subject.actorType]}</span>
            {navigation.company === undefined ? (
              <span>{company}</span>
            ) : (
              <ContributionNavigationLink href={navigation.company}>
                {company}
              </ContributionNavigationLink>
            )}
          </>
        ) : focus.kind === 'company' ? (
          <span>{companyReportMeta(includedAccountCount, !!subject)}</span>
        ) : undefined}
      </ContributionHeading>
      <ViewBar>
        {focus.kind === 'overview' && navigation.areas && (
          <ContributionAreaTabs area={area} hrefs={navigation.areas} lens={lens} />
        )}
        <ContributionReportViewTabs active="timeline" reportHref={reportHref} timelineHref={href} />
      </ViewBar>
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
            companyAttributionLabels[report.scope.companyAttribution],
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
          key={JSON.stringify([report.source, report.request, report.scope, lens])}
          rows={report.rows}
          metrics={contributionTimelineMetrics[lens]}
          grouping={report.request.grouping}
          title="Contributions over time"
          controls={tableControls}
        />
      )}
    </>
  );
}
