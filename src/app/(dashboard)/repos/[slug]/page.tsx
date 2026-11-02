import { repositoryDetail } from '@/server/reporting';
import { RepositoryPageScreen } from '@/app/_screens/repository-page-screen';
import { RepositoryInsightsScreen } from '@/app/_screens/repository-insights-screen';
import { EmptyState } from '@/components/feedback/empty-state';
import Link from 'next/link';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import { RepositoryTimelineRoute } from '@/app/_screens/timeline-route';
import { repositoryPageMetadata } from '@/server/page-metadata';
import { readPreferences } from '@/server/preferences';
import {
  repositoryInsightSort,
  repositoryPagePreferences,
} from '@/app/_screens/repository-preferences';
import { BackIcon } from '@/components/ui/icons';
import { requireViewer } from '@/lib/auth/viewer';
import { canonicalPage } from '@/server/canonical-page';
import styles from '@/features/repositories/repository-page.module.css';
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  return repositoryPageMetadata(
    (await params).slug,
    new URLSearchParams(encodeSearchParams(await searchParams)),
  );
}
export default async function RepositoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  await requireViewer();
  const { slug } = await params;
  const query = await searchParams;
  // These screens still read legacy keys: the helper answers nothing until they read codec values.
  await canonicalPage('/repos/[slug]', { slug: [slug] }, query, { legacyScreens: true });
  const timelineParams = new URLSearchParams(encodeSearchParams(query));
  if (timelineParams.has('timeline'))
    return <RepositoryTimelineRoute slug={slug} params={timelineParams} />;
  const result = await repositoryDetail(slug, new URLSearchParams(encodeSearchParams(query)));
  if (result.status === 'page')
    return (
      <RepositoryPageScreen
        viewerId={result.viewer.id}
        source={result.source}
        navigation={result.navigation}
        preferences={repositoryPagePreferences(
          await readPreferences('repositories'),
          result.source,
        )}
      />
    );
  if (result.status === 'insight')
    return (
      <RepositoryInsightsScreen
        viewerId={result.viewer.id}
        insight={result.insight}
        navigation={result.navigation}
        savedSort={repositoryInsightSort(await readPreferences('repositories'), result.insight)}
      />
    );
  if (result.status === 'invalid' || result.status === 'unsupported')
    return (
      <>
        <Link
          prefetch={false}
          href={result.status === 'unsupported' ? result.returnTo : '/repos'}
          className={styles.backLink}
        >
          <BackIcon size={14} />
          All repositories
        </Link>
        <EmptyState
          kind={result.status === 'invalid' ? 'error' : 'missing'}
          title={
            result.status === 'invalid'
              ? 'Invalid repository filter'
              : 'This drilldown is not available yet'
          }
        >
          {result.status === 'invalid'
            ? 'The requested metric, dates, branch, or return path is invalid. Choose a count from All repositories.'
            : 'Choose another metric from All repositories.'}
        </EmptyState>
      </>
    );
  const unhandled: never = result;
  return unhandled;
}
