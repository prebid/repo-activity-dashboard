import { DisabledTab, ViewTabs } from '@/components/navigation/view-tabs';
import { LinkPending } from '@/components/navigation/link-pending';
import Link from 'next/link';
import {
  BackIcon,
  BranchIcon,
  ExternalLinkIcon,
  IssuesIcon,
  PullRequestsIcon,
  TimelineIcon,
} from '@/components/ui/icons';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { formatAsOf } from '@/lib/presentation/format';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { repositoryTimelineHref } from '@/lib/presentation/timeline-navigation';
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
  timelinePending,
}: {
  repository: OverviewRepository;
  asOf: string;
  returnTo: string;
  navigation?: RepositoryPageNavigation;
  activeKind?: 'prs' | 'issues' | 'timeline';
  timelineHref?: string | null;
  onTimeline?: React.MouseEventHandler<HTMLAnchorElement>;
  /** Set while a navigation started by `onTimeline` is pending. */
  timelinePending?: boolean;
  parentLink?: { href: string; label: string };
}) {
  const timelineLink =
    timelineHref !== undefined
      ? timelineHref
      : repositoryTimelineHref(repository.slug, activeKind === 'issues' ? 'issues' : 'prs');
  return (
    <>
      <div className={styles.breadcrumbs}>
        <Link prefetch={false} href={returnTo}>
          <BackIcon size={14} />
          All repositories
          <LinkPending />
        </Link>
        {parentLink && (
          <>
            <span aria-hidden="true">/</span>
            <Link prefetch={false} href={parentLink.href}>
              <BackIcon size={14} />
              {parentLink.label}
              <LinkPending />
            </Link>
          </>
        )}
      </div>
      <header className={`${heading.layout} ${styles.header}`}>
        <div className={heading.identity}>
          <h1>{repository.name}</h1>
          <div className={styles.meta}>
            <span>
              <BranchIcon size={14} />
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
                <ExternalLinkIcon size={14} />
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
            {kind === 'prs' ? <PullRequestsIcon size={16} /> : <IssuesIcon size={16} />}
            <span>{kind === 'prs' ? 'Pull requests' : 'Issues'}</span>
            {navigation && (
              <span className={styles.tabCount} title="Current open count">
                <MeasurementValue
                  measurement={kind === 'prs' ? navigation.openPrs : navigation.openIssues}
                />
                <span className={styles.countLabel}>open</span>
              </span>
            )}
            <LinkPending />
          </Link>
        ))}
        {timelineLink && (
          <Link
            prefetch={false}
            href={timelineLink}
            onClick={onTimeline}
            aria-current={activeKind === 'timeline' ? 'page' : undefined}
          >
            <TimelineIcon size={16} />
            <span>Timeline</span>
            {/* A click `onTimeline` leaves to the link reports through the link's own status. */}
            <LinkPending pending={timelinePending || undefined} />
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
