import { DisabledTab, ViewTabs } from '@/components/navigation/view-tabs';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  GitBranch,
  GitPullRequest,
  CircleDot,
  CalendarDays,
} from 'lucide-react';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { formatAsOf } from '@/lib/presentation/format';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import styles from './repository-page.module.css';
import heading from './repository-heading.module.css';

export function RepositoryHeader({
  repository,
  asOf,
  returnTo,
  navigation,
  activeKind,
  parentLink,
  timelineHref,
  onTimeline,
}: {
  repository: OverviewRepository;
  asOf: string;
  returnTo: string;
  navigation?: RepositoryPageNavigation;
  activeKind?: 'prs' | 'issues' | 'timeline';
  timelineHref?: string | null;
  onTimeline?: React.MouseEventHandler<HTMLAnchorElement>;
  parentLink?: { href: string; label: string };
}) {
  const timelineLink =
    timelineHref !== undefined
      ? timelineHref
      : '/repos/' +
        encodeURIComponent(repository.slug) +
        '?timeline=1' +
        (activeKind === 'issues' ? '&timeline.kind=issues' : '');
  return (
    <>
      <div className={styles.breadcrumbs}>
        <Link prefetch={false} href={returnTo} aria-label="← All repositories">
          <ArrowLeft size={14} aria-hidden="true" />
          All repositories
        </Link>
        {parentLink && (
          <>
            <span aria-hidden="true">/</span>
            <Link prefetch={false} href={parentLink.href}>
              ← {parentLink.label}
            </Link>
          </>
        )}
      </div>
      <header className={`${heading.layout} ${styles.header}`}>
        <div className={heading.identity}>
          <h1>{repository.name}</h1>
          <div className={styles.meta}>
            <span>
              <GitBranch size={13} aria-hidden="true" />
              {repository.primaryBranch}
              <span>primary branch</span>
            </span>
            {navigation && (
              <Link
                prefetch={false}
                href={navigation.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View repository on GitHub
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
        <p className={`${heading.aside} ${styles.snapshot}`}>
          Reporting snapshot
          <br />
          <time dateTime={asOf}>{formatAsOf(asOf)}</time>
        </p>
      </header>
      <ViewTabs label="Repository lists">
        {(['prs', 'issues'] as const).map((kind) => (
          <Link
            key={kind}
            prefetch={false}
            href={repositoryDrilldownHref(repository, {
              selection: {
                scope: 'current',
                metric: kind === 'prs' ? 'totalOpenPrs' : 'openIssues',
              },
              returnTo,
            })}
            aria-current={activeKind === kind ? 'page' : undefined}
          >
            {kind === 'prs' ? (
              <GitPullRequest size={16} aria-hidden="true" />
            ) : (
              <CircleDot size={16} aria-hidden="true" />
            )}
            <span>{kind === 'prs' ? 'Pull requests' : 'Issues'}</span>
            {navigation && (
              <span className={styles.tabCount} title="Current open count">
                <MeasurementValue
                  measurement={kind === 'prs' ? navigation.openPrs : navigation.openIssues}
                />
                <span className={styles.countLabel}>open</span>
              </span>
            )}
          </Link>
        ))}
        {timelineLink && (
          <Link
            prefetch={false}
            href={timelineLink}
            onClick={onTimeline}
            aria-current={activeKind === 'timeline' ? 'page' : undefined}
          >
            <CalendarDays size={16} aria-hidden="true" />
            <span>Timeline</span>
          </Link>
        )}
        {!timelineLink && (
          <DisabledTab reason="These filters cannot be carried into Timeline. Reduce or clear the filters to continue.">
            Timeline
          </DisabledTab>
        )}
      </ViewTabs>
    </>
  );
}
