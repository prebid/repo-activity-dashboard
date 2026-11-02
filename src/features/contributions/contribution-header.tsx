import { DisabledTab, ViewTabs } from '@/components/navigation/view-tabs';
import { LinkPending } from '@/components/navigation/link-pending';
import { countLabel } from '@/lib/presentation/format';
import { accountTypeLabels } from '@/models/github-account';
import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { GitHubAccountLink } from '@/components/github/account-link';
import {
  BackIcon,
  CompaniesIcon,
  ContributorsIcon,
  ReportIcon,
  TimelineIcon,
} from '@/components/ui/icons';
import type { ContributionPage } from '@/models/contribution-page';
import { contributionActorTypes, type ContributionAccount } from '@/models/contributions';
import { formatAsOf } from '@/lib/presentation/format';
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

import styles from './contributions.module.css';

/** Report | Over time, shared by the report header and the Over time view. */
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
    <ViewTabs label="Report view">
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
  return (
    <>
      {report.kind !== 'overview' && (
        <nav className={styles.breadcrumbs} aria-label="Contribution breadcrumb">
          <Link prefetch={false} href={page.returnTo}>
            <BackIcon size={14} /> Back to report
            <LinkPending />
          </Link>
        </nav>
      )}
      <ContributionHeading
        title={title}
        asOf={context.asOf}
        eyebrow={
          report.kind === 'overview'
            ? 'Contribution activity'
            : report.kind === 'contributor'
              ? 'Contributor report'
              : 'Company report'
        }
        identity={
          report.kind === 'contributor' ? (
            <ContributionSubjectAvatar subject={{ kind: 'contributor', account: report.account }} />
          ) : report.kind === 'company' ? (
            <ContributionSubjectAvatar subject={{ kind: 'company', company: report.company }} />
          ) : undefined
        }
      >
        {report.kind === 'overview' ? (
          <p className={styles.subtitle}>
            {page.area === 'contributors'
              ? 'Understand who authors, reviews and merges work.'
              : 'Explore contribution activity by current company affiliation.'}
          </p>
        ) : report.kind === 'contributor' ? (
          <div className={styles.meta}>
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
          </div>
        ) : (
          <p className={styles.subtitle}>
            {report.memberCount} included {report.memberCount === 1 ? 'account' : 'accounts'} ·{' '}
            {report.company ? 'Current company mapping' : 'Accounts without a company mapping'}
          </p>
        )}
      </ContributionHeading>
      {report.kind === 'overview' && (
        <ViewTabs label="Contribution reports">
          <ContributionTab
            href={contributionHref('contributors', page.sample, undefined, links.settings)}
            reason="This selection is too large for a Contributors link. Narrow the filters and try again."
            onClick={(event) => links.onAreaFollow?.(event, 'contributors')}
            pending={links.pendingTarget === 'contributors'}
            aria-current={page.area === 'contributors' ? 'page' : undefined}
          >
            <ContributorsIcon size={16} /> Contributors{' '}
            <span className={styles.tabCount}>{report.contributorCount}</span>
          </ContributionTab>
          <ContributionTab
            href={contributionHref('companies', page.sample, undefined, links.settings)}
            reason="This selection is too large for a Companies link. Narrow the filters and try again."
            onClick={(event) => links.onAreaFollow?.(event, 'companies')}
            pending={links.pendingTarget === 'companies'}
            aria-current={page.area === 'companies' ? 'page' : undefined}
          >
            <CompaniesIcon size={16} /> Companies{' '}
            <span className={styles.tabCount}>{report.companyCount}</span>
          </ContributionTab>
        </ViewTabs>
      )}
      {!page.details && links.timelineHref !== undefined && (
        <ContributionReportViewTabs
          active="report"
          reportHref={links.currentHref}
          timelineHref={links.timelineHref}
          onTimeline={links.onTimeline}
          timelinePending={links.pendingTarget === 'timeline'}
        />
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

/** Shared heading for list and Over time views; metric data stays with each view. */
export function ContributionHeading({
  title,
  asOf,
  eyebrow,
  identity,
  children,
}: {
  title: string;
  asOf: string;
  eyebrow: string;
  /** The subject's avatar beside the title on contributor and company reports. */
  identity?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        {identity}
        <div className={styles.headingText}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          {children}
        </div>
      </div>
      <p className={styles.snapshot}>
        Reporting snapshot
        <br />
        <time dateTime={asOf}>{formatAsOf(asOf)}</time>
      </p>
    </header>
  );
}
