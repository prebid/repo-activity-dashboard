'use client';
import Link from 'next/link';
import { PageHeader, type PageHeaderCrumb } from '@/components/navigation/page-header';
import type { PageSection } from '@/components/navigation/section-nav';
import { ViewBar } from '@/components/navigation/view-bar';
import { DisabledTab, TabCount, ViewTabs } from '@/components/navigation/view-tabs';
import { LinkPending } from '@/components/navigation/link-pending';
import {
  BranchIcon,
  ExternalLinkIcon,
  IssuesIcon,
  PullRequestsIcon,
  TimelineIcon,
} from '@/components/ui/icons';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import {
  drilldownPresentation,
  type RepositoryLinkPresentation,
} from '@/lib/presentation/repository-url';
import { useRepositoriesEntryHref } from '@/lib/navigation/use-repositories-entry';
import { repositoryTimelineHref } from '@/lib/presentation/timeline-navigation';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import styles from './repository-page.module.css';

/**
 * A repository page's header and view bar. The repository name stays the h1 on every subpage; a
 * subpage names itself as the breadcrumb's current view (`current`) and marks the list it
 * belongs to (`contextKind`) without claiming that list's tab as the current page.
 */
export function RepositoryHeader({
  repository,
  asOf,
  returnTo,
  returnSection,
  links,
  navigation,
  activeKind,
  contextKind,
  current,
  parentLink,
  timelineHref,
  onTimeline,
  timelinePending,
  sections,
}: {
  repository: OverviewRepository;
  asOf: string;
  /**
   * The Summary this page returns to: `/repos` when the address names none (the crumb then opens
   * the viewer's saved Summary, as the masthead does), null when it cannot be restored.
   */
  returnTo: string | null;
  /** The Summary panel the "All repositories" crumb returns to, such as `period-activity`. */
  returnSection?: string;
  /** The viewer's saved list presentation, which the list tabs carry. */
  links?: RepositoryLinkPresentation;
  navigation?: RepositoryPageNavigation;
  activeKind?: 'prs' | 'issues' | 'timeline';
  /** The list a subpage belongs to, when no tab is the current page. */
  contextKind?: 'prs' | 'issues';
  /** The subpage's name, shown unlinked after the breadcrumb links. */
  current?: string;
  timelineHref?: string | null;
  onTimeline?: React.MouseEventHandler<HTMLAnchorElement>;
  /** Set while a navigation started by `onTimeline` is pending. */
  timelinePending?: boolean;
  parentLink?: { href: string | null; label: string };
  /** The page's panels, which the view bar links to when there are two or more. */
  sections?: readonly PageSection[];
}) {
  const timelineLink =
    timelineHref !== undefined
      ? timelineHref
      : repositoryTimelineHref(
          repository.slug,
          (activeKind ?? contextKind) === 'issues' ? 'issues' : 'prs',
        );
  const entry = useRepositoriesEntryHref(asOf);
  const summary = returnTo === '/repos' ? entry : returnTo;
  const breadcrumbs: PageHeaderCrumb[] = [
    {
      label: 'All repositories',
      href: summary && summary + (returnSection ? '#' + returnSection : ''),
    },
  ];
  if (parentLink) breadcrumbs.push(parentLink);
  const listHref = (kind: 'prs' | 'issues') => {
    const selection = {
      scope: 'current',
      metric: kind === 'prs' ? 'totalOpenPrs' : 'openIssues',
    } as const;
    return repositoryDrilldownHref(
      repository,
      { selection, returnTo },
      drilldownPresentation(selection, links),
    );
  };
  const tabState = (kind: 'prs' | 'issues' | 'timeline') =>
    activeKind === kind ? 'page' : contextKind === kind ? 'true' : undefined;
  return (
    <>
      <PageHeader
        title={repository.name}
        asOf={asOf}
        sampleData={navigation?.sample}
        breadcrumbs={breadcrumbs}
        current={current}
        meta={
          <>
            <span>
              <BranchIcon size={14} />
              Primary branch <code className={styles.branch}>{repository.primaryBranch}</code>
            </span>
            {navigation && (
              <a href={navigation.githubUrl} target="_blank" rel="noopener noreferrer">
                View repository on GitHub
                <ExternalLinkIcon size={14} />
              </a>
            )}
          </>
        }
      />
      <ViewBar sections={sections}>
        <ViewTabs label="Repository lists">
          {(['prs', 'issues'] as const).map((kind) => (
            <Link key={kind} prefetch={false} href={listHref(kind)} aria-current={tabState(kind)}>
              {kind === 'prs' ? <PullRequestsIcon size={16} /> : <IssuesIcon size={16} />}
              {kind === 'prs' ? 'Pull requests' : 'Issues'}
              {navigation && (
                <TabCount unit="open" title="Current open count">
                  <MeasurementValue
                    measurement={kind === 'prs' ? navigation.openPrs : navigation.openIssues}
                  />
                </TabCount>
              )}
              <LinkPending />
            </Link>
          ))}
          {timelineLink && (
            <Link
              prefetch={false}
              href={timelineLink}
              onClick={onTimeline}
              aria-current={tabState('timeline')}
            >
              <TimelineIcon size={16} />
              Timeline
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
      </ViewBar>
    </>
  );
}
