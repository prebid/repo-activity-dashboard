import Link from 'next/link';
import { timelineView } from '@/server/timeline-preview';
import { readPreferences } from '@/server/preferences';
import {
  RepositoryTimelineMatrixScreen,
  RepositoryTimelineScreen,
  ContributionTimelineScreen,
} from './timeline-screens';
import type { ContributionArea } from '@/models/contribution-page';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/navigation/page-header';
import { loadTimelineSupport } from '@/server/timeline-support';
import { TimelineSupportScreen } from './timeline-support-screen';
import { readTimelineSupportSort } from './repository-preferences';
import type { UrlView } from '@/lib/presentation/url/back';
import { routeArea, routePath, screenOf } from '@/lib/presentation/url/registry';

export function InvalidTimeline({ message, href }: { message: string; href: string }) {
  return (
    <>
      {/* No snapshot is read for an invalid view, so the header states no snapshot time. */}
      <PageHeader title="Timeline" asOf="" />
      <EmptyState kind="error" title="Invalid timeline view">
        {message} <Link href={href}>Return to report</Link>
      </EmptyState>
    </>
  );
}
/**
 * A Timeline page or a Timeline supporting view, from the page helper's canonical values: legacy
 * links and entry redirects were answered there, so an entry renders here at its own address.
 */
export async function TimelineRoute({ view, entry }: { view: UrlView; entry: boolean }) {
  if (screenOf(view.route, view.values) === 'support') return <TimelineSupportRoute view={view} />;
  const result = await timelineView(view, {
    entry,
    preferences: await readPreferences(routeArea(view.route)),
  });
  if (result.status !== 'ready')
    return <InvalidTimeline message={result.message} href={routePath(view.route, view.segments)} />;
  if ('matrix' in result)
    return (
      <RepositoryTimelineMatrixScreen
        viewerId={result.viewerId}
        context={result.controls}
        matrix={result.matrix}
        summaryHref={result.summaryHref}
      />
    );
  if ('omitted' in result)
    return (
      <RepositoryTimelineScreen
        viewerId={result.viewerId}
        context={result.controls}
        parent={result.parent}
        facets={result.facets}
        omitted={result.omitted}
        report={result.report}
        navigation={result.navigation}
      />
    );
  const area: ContributionArea = view.route.startsWith('/companies') ? 'companies' : 'contributors';
  return (
    <ContributionTimelineScreen
      viewerId={result.viewerId}
      context={result.controls}
      report={result.report}
      area={area}
      reportHref={result.reportHref}
      returnTo={result.returnTo}
      returnLabel={result.returnLabel}
    />
  );
}
async function TimelineSupportRoute({ view }: { view: UrlView }) {
  const result = await loadTimelineSupport(view);
  return result.status === 'ready' ? (
    <TimelineSupportScreen
      detail={result.detail}
      viewerId={result.viewerId}
      savedSort={await readTimelineSupportSort(result.detail)}
    />
  ) : (
    <InvalidTimeline
      message={result.message}
      href={result.parentHref ?? routePath(view.route, view.segments)}
    />
  );
}
