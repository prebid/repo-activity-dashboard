import Link from 'next/link';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/navigation/page-header';
import type { PageSection } from '@/components/navigation/section-nav';
import { ViewBar } from '@/components/navigation/view-bar';
import { DisabledTab, ViewTabs } from '@/components/navigation/view-tabs';
import { LinkPending } from '@/components/navigation/link-pending';
import { ExternalLinkIcon, ReportIcon, TimelineIcon } from '@/components/ui/icons';

/**
 * All repositories for an address it cannot show: an unknown parameter, or repositories, periods
 * or PR ages it does not offer. No report is loaded, so the header states no snapshot time.
 */
export function InvalidRepositoriesView({ message }: { message: string }) {
  return (
    <>
      <PageHeader title="All repositories" asOf="" />
      <EmptyState kind="error" title="Invalid All repositories view">
        {message}{' '}
        <Link prefetch={false} href="/repos">
          Open All repositories
        </Link>
      </EmptyState>
    </>
  );
}
export function AllRepositoriesHeading({ asOf }: { asOf: string }) {
  return (
    <PageHeader
      title="All repositories"
      asOf={asOf}
      meta={
        <a href="https://github.com/prebid" target="_blank" rel="noopener noreferrer">
          Prebid on GitHub
          <ExternalLinkIcon size={14} />
        </a>
      }
    />
  );
}
/** Summary and Timeline are two modes of one view; `sections` are the panels the bar links to. */
export function AllRepositoriesTabs({
  active,
  summaryHref,
  timelineHref,
  sections,
}: {
  active: 'summary' | 'timeline';
  summaryHref: string;
  timelineHref: string | null;
  sections?: readonly PageSection[];
}) {
  return (
    <ViewBar sections={sections}>
      <ViewTabs label="Repository overview views" variant="segmented">
        <Link
          prefetch={false}
          href={summaryHref}
          aria-current={active === 'summary' ? 'page' : undefined}
        >
          <ReportIcon size={16} />
          Summary
          <LinkPending />
        </Link>
        {timelineHref ? (
          <Link
            prefetch={false}
            href={timelineHref}
            aria-current={active === 'timeline' ? 'page' : undefined}
          >
            <TimelineIcon size={16} />
            Timeline
            <LinkPending />
          </Link>
        ) : (
          <DisabledTab reason="This view is too large for a timeline link. Reduce the selection and try again.">
            Timeline
          </DisabledTab>
        )}
      </ViewTabs>
    </ViewBar>
  );
}
