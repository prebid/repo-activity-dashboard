import { notFound } from 'next/navigation';
import { catalogRepository, repositoryDetail } from '@/server/reporting';
import { RepositoryPageScreen } from '@/app/_screens/repository-page-screen';
import { RepositoryInsightsScreen } from '@/app/_screens/repository-insights-screen';
import { EmptyState } from '@/components/feedback/empty-state';
import Link from 'next/link';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { legacySearchParams, queryPairs } from '@/lib/presentation/url/codec';
import { RepositoryTimelineRoute } from '@/app/_screens/timeline-route';
import { repositoryPageMetadata } from '@/server/page-metadata';
import { readPreferences } from '@/server/preferences';
import {
  recordEntryValues,
  repositoryInsightSort,
  repositoryLinkPresentation,
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
  return repositoryPageMetadata((await params).slug, legacySearchParams(await searchParams));
}
function InvalidRepositoryView() {
  return (
    <>
      <Link prefetch={false} href="/repos" className={styles.backLink}>
        <BackIcon size={14} />
        All repositories
      </Link>
      <EmptyState kind="error" title="Invalid repository filter">
        The requested metric, dates, branch, or return path is invalid. Choose a count from All
        repositories.
      </EmptyState>
    </>
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
  if (!catalogRepository(slug)) notFound();
  const query = await searchParams;
  const snapshot = await readPreferences('repositories');
  const links = repositoryLinkPresentation(snapshot);
  // The repository Timeline still reads legacy keys, so the helper hands its query back unchanged.
  const page = await canonicalPage(
    '/repos/[slug]',
    { slug: [slug] },
    query,
    queryPairs(query).some(([key]) => key === 'timeline')
      ? { legacyScreens: true }
      : { saved: (_screen, values) => recordEntryValues(values, links) },
  );
  if (page.status === 'legacy') return <RepositoryTimelineRoute slug={slug} params={page.params} />;
  if (page.status === 'invalid') return <InvalidRepositoryView />;
  const result = await repositoryDetail(slug, page.values);
  if (result.status === 'page')
    return (
      <RepositoryPageScreen
        viewerId={result.viewer.id}
        source={result.source}
        navigation={result.navigation}
        preferences={repositoryPagePreferences(snapshot, result.source)}
      />
    );
  if (result.status === 'insight')
    return (
      <RepositoryInsightsScreen
        viewerId={result.viewer.id}
        insight={result.insight}
        navigation={result.navigation}
        savedSort={repositoryInsightSort(snapshot, result.insight)}
        links={links}
      />
    );
  return <InvalidRepositoryView />;
}
