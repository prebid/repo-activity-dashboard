import Link from 'next/link';
import {
  contributionTimelinePreview,
  repositoryTimelinePreview,
  repositoryTimelineMatrixPreview,
} from '@/server/timeline-preview';
import {
  RepositoryTimelineMatrixScreen,
  RepositoryTimelineScreen,
  ContributionTimelineScreen,
} from './timeline-screens';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { PageState } from '@/components/feedback/page-state';
import { loadTimelineSupport } from '@/server/timeline-support';
import { TimelineSupportScreen } from './timeline-support-screen';
import { contributionPath } from '@/lib/presentation/contribution-navigation';
function InvalidTimeline({ message, href }: { message: string; href: string }) {
  return (
    <>
      <h1>Timeline</h1>
      <PageState title="Invalid timeline view">
        {message} <Link href={href}>Return to report</Link>
      </PageState>
    </>
  );
}
export async function RepositoryTimelineMatrixRoute({ params }: { params: URLSearchParams }) {
  const result = await repositoryTimelineMatrixPreview(params);
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
  const result = await repositoryTimelinePreview(slug, params);
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
  const result = await contributionTimelinePreview(area, params, focus);
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
