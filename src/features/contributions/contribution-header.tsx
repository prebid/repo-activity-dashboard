import { PageHeader } from '@/components/navigation/page-header';
import { ViewBar } from '@/components/navigation/view-bar';
import { DisabledTab, ViewTabs } from '@/components/navigation/view-tabs';
import { LinkPending } from '@/components/navigation/link-pending';
import { countLabel } from '@/lib/presentation/format';
import { accountTypeLabels } from '@/models/github-account';
import Link from 'next/link';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { GitHubAccountLink } from '@/components/github/account-link';
import { CompaniesIcon, ContributorsIcon, ReportIcon, TimelineIcon } from '@/components/ui/icons';
import type { ContributionArea, ContributionPage } from '@/models/contribution-page';
import { contributionActorTypes, type ContributionAccount } from '@/models/contributions';
import { zonedRangeLabel } from '@/lib/presentation/overview-periods';
import {
  noReportControls,
  ReportToolbar,
  type ReportToolbarControls,
} from '@/components/reporting/report-toolbar';
import { contributionHref } from '@/lib/presentation/contribution-navigation';
import { contributionSubjectTitle } from '@/lib/presentation/page-title';
import { Avatar, type AvatarAccountType } from '@/components/github/avatar';
import { CompanyAvatar, EntityLink, type ContributionLinks } from './contribution-columns';

/** A report tab, or a focusable unavailable tab that states why when no link fits. */
function ContributionTab({
  href,
  reason,
  pending,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string | null;
  reason: string;
  pending?: boolean;
}) {
  return href ? (
    <Link prefetch={false} href={href} {...props}>
      {children}
      {/* A click the handler leaves to the link reports through the link's own status. */}
      <LinkPending pending={pending || undefined} />
    </Link>
  ) : (
    <DisabledTab reason={reason}>{children}</DisabledTab>
  );
}

const areaTabs = {
  contributors: { label: 'Contributors', Icon: ContributorsIcon },
  companies: { label: 'Companies', Icon: CompaniesIcon },
} as const;

/** Contributors | Companies: an overview's subjects, on Report and on Over time. */
export function ContributionAreaTabs({
  area,
  hrefs,
  onFollow,
  pendingTarget,
}: {
  area: ContributionArea;
  /** Each area's link; null when its URL does not fit. */
  hrefs: Record<ContributionArea, string | null>;
  onFollow?: (event: MouseEvent<HTMLAnchorElement>, area: ContributionArea) => void;
  /** The area whose handler-started navigation is pending. */
  pendingTarget?: string | null;
}) {
  return (
    <ViewTabs label="Contribution reports">
      {(['contributors', 'companies'] as const).map((target) => {
        const { label, Icon } = areaTabs[target];
        return (
          <ContributionTab
            key={target}
            href={hrefs[target]}
            reason={`This selection is too large for a ${label} link. Narrow the filters and try again.`}
            onClick={onFollow && ((event) => onFollow(event, target))}
            pending={pendingTarget === target}
            aria-current={area === target ? 'page' : undefined}
          >
            <Icon size={16} /> {label}
          </ContributionTab>
        );
      })}
    </ViewTabs>
  );
}

/** Report | Over time, shared by the report header and the Over time view. */
export function ContributionReportViewTabs({
  active,
  reportHref,
  timelineHref,
  onTimeline,
  timelinePending,
}: {
  active: 'report' | 'timeline';
  reportHref: string;
  timelineHref: string | null;
  onTimeline?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Set while a navigation started by `onTimeline` is pending. */
  timelinePending?: boolean;
}) {
  return (
    <ViewTabs label="Report view" variant="segmented">
      <Link
        prefetch={false}
        href={reportHref}
        aria-current={active === 'report' ? 'page' : undefined}
      >
        <ReportIcon size={16} />
        Report
        <LinkPending />
      </Link>
      <ContributionTab
        href={timelineHref}
        reason="This selection is too large for an Over time link. Narrow the filters or search and try again."
        onClick={onTimeline}
        pending={timelinePending}
        aria-current={active === 'timeline' ? 'page' : undefined}
      >
        <TimelineIcon size={16} />
        Over time
      </ContributionTab>
    </ViewTabs>
  );
}

/** A company report's meta line: its included accounts and how they are attributed. */
export function companyReportMeta(memberCount: number, mapped: boolean): string {
  return (
    memberCount +
    ' included ' +
    (memberCount === 1 ? 'account' : 'accounts') +
    ' · ' +
    (mapped ? 'Current company mapping' : 'Accounts without a company mapping')
  );
}

export function ContributionHeader({
  page,
  links,
  toolbar = noReportControls,
}: {
  page: ContributionPage;
  links: ContributionLinks;
  /** The report filters; the header adds the report's scope summary. */
  toolbar?: ReportToolbarControls;
}) {
  const report = page.report,
    context = report.context;
  const title = contributionSubjectTitle(
    page.area,
    report.kind === 'overview'
      ? 'overview'
      : report.kind === 'contributor'
        ? report.account
        : report.company,
  );
  const subjects = report.kind === 'overview' && (
    <ContributionAreaTabs
      area={page.area}
      hrefs={{
        contributors: contributionHref(
          'contributors',
          page.sample,
          undefined,
          links.settings,
          links.saved,
        ),
        companies: contributionHref(
          'companies',
          page.sample,
          undefined,
          links.settings,
          links.saved,
        ),
      }}
      onFollow={links.onAreaFollow}
      pendingTarget={links.pendingTarget}
    />
  );
  const modes = !page.details && links.timelineHref !== undefined && (
    <ContributionReportViewTabs
      active="report"
      reportHref={links.currentHref}
      timelineHref={links.timelineHref}
      onTimeline={links.onTimeline}
      timelinePending={links.pendingTarget === 'timeline'}
    />
  );
  return (
    <>
      <ContributionHeading
        title={title}
        asOf={context.asOf}
        returnTo={report.kind === 'overview' ? undefined : page.returnTo}
        identity={
          report.kind === 'contributor' ? (
            <ContributionSubjectAvatar subject={{ kind: 'contributor', account: report.account }} />
          ) : report.kind === 'company' ? (
            <ContributionSubjectAvatar subject={{ kind: 'company', company: report.company }} />
          ) : undefined
        }
      >
        {report.kind === 'contributor' ? (
          <>
            <GitHubAccountLink
              login={report.account.login}
              url={report.account.profileUrl}
              label={'@' + report.account.login}
            />
            <span>{accountTypeLabels[report.account.actorType]}</span>
            <EntityLink
              links={links}
              focus={{ kind: 'company', companyId: report.company?.id ?? null }}
            >
              {report.company?.name ?? 'Unmapped company'}
            </EntityLink>
          </>
        ) : report.kind === 'company' ? (
          <span>{companyReportMeta(report.memberCount, !!report.company)}</span>
        ) : undefined}
      </ContributionHeading>
      {(subjects || modes) && (
        <ViewBar>
          {subjects}
          {modes}
        </ViewBar>
      )}
      <ReportToolbar
        label="Contribution report scope"
        {...toolbar}
        summary={{
          lead: zonedRangeLabel(context.range),
          facts: [
            ...accountTypesFact(context.selection.actorTypes),
            context.includedAccountCount +
              ' ' +
              countLabel(context.includedAccountCount, {
                singular: 'included account',
                plural: 'included accounts',
              }),
            'Company attribution: current mapping',
          ],
        }}
      />
    </>
  );
}

/**
 * The included account types, in their fixed order, as a scope summary fact. With every type
 * included there is none: the Account type control already reads "All".
 */
export function accountTypesFact(selected: readonly ContributionAccount['actorType'][]): string[] {
  const types = contributionActorTypes.filter((type) => selected.includes(type));
  if (types.length === contributionActorTypes.length) return [];
  if (!types.length) return ['No account types'];
  return [
    (types.length === 1 ? 'Account type: ' : 'Account types: ') +
      types.map((type) => accountTypeLabels[type]).join(', '),
  ];
}

/** A focused report's subject at the heading's 48px identity size; the overview has none. */
export function ContributionSubjectAvatar({
  subject,
}: {
  subject:
    | { kind: 'contributor'; account: { name: string; actorType: AvatarAccountType } }
    | { kind: 'company'; company: { name: string } | null };
}) {
  return subject.kind === 'contributor' ? (
    <Avatar
      kind="person"
      name={subject.account.name}
      accountType={subject.account.actorType}
      size={48}
    />
  ) : (
    <CompanyAvatar company={subject.company} size={48} />
  );
}

/**
 * Shared heading for list and Over time views, so switching between them keeps the header's
 * rows and everything below it in place; metric data stays with each view.
 */
export function ContributionHeading({
  title,
  asOf,
  returnTo,
  identity,
  children,
}: {
  title: string;
  asOf: string;
  /**
   * On a contributor or company report, the report "Back to report" opens; null when the page it
   * came from cannot be restored, which shows the crumb unavailable.
   */
  returnTo?: string | null;
  /** The subject's avatar beside the title on contributor and company reports. */
  identity?: ReactNode;
  /** The one meta line under the title. */
  children?: ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      asOf={asOf}
      breadcrumbLabel="Contribution breadcrumb"
      breadcrumbs={
        returnTo === undefined ? undefined : [{ label: 'Back to report', href: returnTo }]
      }
      identity={identity}
      meta={children}
    />
  );
}
