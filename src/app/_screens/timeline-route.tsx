import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  contributionTimelinePreview,
  repositoryTimelinePreview,
  repositoryTimelineMatrixPreview,
} from '@/server/timeline-preview';
import { readPreferences } from '@/server/preferences';
import {
  RepositoryTimelineMatrixScreen,
  RepositoryTimelineScreen,
  ContributionTimelineScreen,
} from './timeline-screens';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/navigation/page-header';
import { loadTimelineSupport } from '@/server/timeline-support';
import { TimelineSupportScreen } from './timeline-support-screen';
import { contributionPath } from '@/lib/presentation/contribution-navigation';
function InvalidTimeline({ message, href }: { message: string; href: string }) {
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
// An entry URL, one without timeline.state, is answered with a redirect to its explicit-state URL
// with saved preferences applied, so the page renders once and never rewrites its address.
export async function RepositoryTimelineMatrixRoute({ params }: { params: URLSearchParams }) {
  const result = await repositoryTimelineMatrixPreview(
    params,
    await readPreferences('repositories'),
  );
  if (result.status === 'redirect') redirect(result.href);
  return result.status === 'ready' ? (
    <RepositoryTimelineMatrixScreen
      viewerId={result.viewerId}
      context={result.controls}
      matrix={result.matrix}
      summaryHref={result.summaryHref}
    />
  ) : (
    <InvalidTimeline message={result.message} href="/repos" />
  );
}
export async function RepositoryTimelineRoute({
  slug,
  params,
}: {
  slug: string;
  params: URLSearchParams;
}) {
  if (params.has('timeline.detail'))
    return <TimelineSupportRoute path={'/repos/' + encodeURIComponent(slug)} params={params} />;
  const result = await repositoryTimelinePreview(
    slug,
    params,
    await readPreferences('repositories'),
  );
  if (result.status === 'redirect') redirect(result.href);
  return result.status === 'ready' ? (
    <RepositoryTimelineScreen
      viewerId={result.viewerId}
      context={result.controls}
      parent={result.parent}
      facets={result.facets}
      omitted={result.omitted}
      report={result.report}
      navigation={result.navigation}
    />
  ) : (
    <InvalidTimeline message={result.message} href={'/repos/' + encodeURIComponent(slug)} />
  );
}
export async function ContributionTimelineRoute({
  area,
  params,
  focus,
}: {
  area: ContributionArea;
  params: URLSearchParams;
  focus?: ContributionFocus;
}) {
  if (params.has('timeline.detail'))
    return (
      <TimelineSupportRoute
        path={contributionPath(!focus || focus.kind === 'overview' ? area : focus)}
        params={params}
      />
    );
  const result = await contributionTimelinePreview(
    area,
    params,
    focus,
    await readPreferences('contributions'),
  );
  if (result.status === 'redirect') redirect(result.href);
  return result.status === 'ready' ? (
    <ContributionTimelineScreen
      viewerId={result.viewerId}
      context={result.controls}
      report={result.report}
      area={area}
      reportHref={result.reportHref}
    />
  ) : (
    <InvalidTimeline message={result.message} href={'/' + area} />
  );
}
async function TimelineSupportRoute({ path, params }: { path: string; params: URLSearchParams }) {
  const result = await loadTimelineSupport(path, params);
  return result.status === 'ready' ? (
    <TimelineSupportScreen detail={result.detail} viewerId={result.viewerId} />
  ) : (
    <InvalidTimeline message={result.message} href={result.parentHref ?? path} />
  );
}
