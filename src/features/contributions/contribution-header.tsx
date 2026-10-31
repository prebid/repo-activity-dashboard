import { DisabledTab, ViewTabs } from '@/components/navigation/view-tabs';
import { countLabel } from '@/lib/presentation/format';
import { contributionActorTypes } from '@/models/contributions';
import { accountTypeLabels } from '@/models/github-account';
import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { GitHubAccountLink } from '@/components/github/account-link';
import { ArrowLeft, Users, Building2, Table2, CalendarDays } from 'lucide-react';
import type { ContributionPage } from '@/models/contribution-page';
import { formatAsOf } from '@/lib/presentation/format';
import { periodRangeLabel, periodLabels } from '@/lib/presentation/overview-periods';
import { contributionHref } from '@/lib/presentation/contribution-navigation';
import { EntityLink, type ContributionLinks } from './contribution-columns';

import styles from './contributions.module.css';

export function contributionTitle(page: ContributionPage): string {
  return page.report.kind === 'overview'
    ? page.area === 'contributors'
      ? 'Contributors'
      : 'Companies'
    : page.report.kind === 'contributor'
      ? page.report.account.name
      : (page.report.company?.name ?? 'Unmapped company');
}

/** Report | Over time, shared by the report header and the Over time view. */
/** A report tab, or a focusable unavailable tab that states why when no link fits. */
function ContributionTab({
  href,
  reason,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { href: string | null; reason: string }) {
  return href ? (
    <Link prefetch={false} href={href} {...props}>
      {children}
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
}: {
  active: 'report' | 'timeline';
  reportHref: string;
  timelineHref: string | null;
  onTimeline?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <ViewTabs label="Report view">
      <Link
        prefetch={false}
        href={reportHref}
        aria-current={active === 'report' ? 'page' : undefined}
      >
        <Table2 size={16} aria-hidden="true" />
        Report
      </Link>
      <ContributionTab
        href={timelineHref}
        reason="This selection is too large for an Over time link. Narrow the filters or search and try again."
        onClick={onTimeline}
        aria-current={active === 'timeline' ? 'page' : undefined}
      >
        <CalendarDays size={16} aria-hidden="true" />
        Over time
      </ContributionTab>
    </ViewTabs>
  );
}
export function ContributionHeader({
  page,
  links,
  controls,
}: {
  page: ContributionPage;
  links: ContributionLinks;
  controls?: React.ReactNode;
}) {
  const report = page.report,
    context = report.context;
  const title = contributionTitle(page);
  return (
    <>
      {report.kind !== 'overview' && (
        <nav className={styles.breadcrumbs} aria-label="Contribution breadcrumb">
          <Link prefetch={false} href={page.returnTo}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to report
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
            aria-current={page.area === 'contributors' ? 'page' : undefined}
          >
            <Users size={16} aria-hidden="true" /> Contributors{' '}
            <span className={styles.tabCount}>{report.contributorCount}</span>
          </ContributionTab>
          <ContributionTab
            href={contributionHref('companies', page.sample, undefined, links.settings)}
            reason="This selection is too large for a Companies link. Narrow the filters and try again."
            onClick={(event) => links.onAreaFollow?.(event, 'companies')}
            aria-current={page.area === 'companies' ? 'page' : undefined}
          >
            <Building2 size={16} aria-hidden="true" /> Companies{' '}
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
        />
      )}
      <section className={styles.scope} aria-label="Contribution report scope">
        <div>
          <span className={styles.scopeLabel}>
            {context.period.kind === 'preset'
              ? periodLabels[context.period.preset]
              : 'Custom range'}
          </span>
          <strong>{periodRangeLabel(context.range)}</strong>
        </div>
        <div className={styles.scopeDetails}>
          <span>
            {new Set(context.selection.repositoryIds).size}{' '}
            {countLabel(new Set(context.selection.repositoryIds).size, {
              singular: 'repository',
              plural: 'repositories',
            })}
          </span>
          <span>
            {new Set(context.selection.actorTypes).size === contributionActorTypes.length
              ? 'All account types'
              : context.selection.actorTypes.map((type) => accountTypeLabels[type]).join(', ') ||
                'No account types'}
          </span>
          <span>
            {context.includedAccountCount}{' '}
            {countLabel(context.includedAccountCount, {
              singular: 'included account',
              plural: 'included accounts',
            })}
          </span>
          <span>
            {context.selection.population.kind === 'selected' ||
            context.selection.excludedAccountIds.length
              ? 'Filtered population'
              : 'All accounts'}
          </span>
          {context.selection.excludedAccountIds.length > 0 && (
            <span>{context.selection.excludedAccountIds.length} explicitly excluded</span>
          )}
          <span>Company attribution: current mapping</span>
        </div>
        {controls}
      </section>
    </>
  );
}

/** Shared heading for list and Over time views; metric data stays with each view. */
export function ContributionHeading({
  title,
  asOf,
  eyebrow,
  children,
}: {
  title: string;
  asOf: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </div>
      <p className={styles.snapshot}>
        Reporting snapshot
        <br />
        <time dateTime={asOf}>{formatAsOf(asOf)}</time>
      </p>
    </header>
  );
}
