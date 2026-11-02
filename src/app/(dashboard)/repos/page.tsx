import { allRepositories } from '@/server/reporting';
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { RepositoryTimelineMatrixRoute } from '@/app/_screens/timeline-route';
import { repositoriesPageMetadata } from '@/server/page-metadata';
import { readPreferences } from '@/server/preferences';
import { repositoriesPreferences, summaryEntryValues } from '@/app/_screens/repository-preferences';
import { InvalidRepositoriesView } from '@/features/repositories/all-repositories-header';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import { requireViewer } from '@/lib/auth/viewer';
import { readOverviewValues } from '@/lib/presentation/overview-settings';
import { legacySearchParams, queryPairs } from '@/lib/presentation/url/codec';
import { canonicalPage } from '@/server/canonical-page';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return repositoriesPageMetadata(legacySearchParams(await searchParams));
}
export default async function AllReposPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  await requireViewer();
  const query = await searchParams;
  const { viewer, samples } = await allRepositories();
  const preferences = repositoriesPreferences(await readPreferences('repositories'), samples);
  // The matrix Timeline still reads legacy keys, so the helper hands its query back unchanged.
  const page = await canonicalPage(
    '/repos',
    {},
    query,
    queryPairs(query).some(([key]) => key === 'timeline')
      ? { legacyScreens: true }
      : { saved: () => summaryEntryValues(preferences) },
  );
  if (page.status === 'legacy') return <RepositoryTimelineMatrixRoute params={page.params} />;
  if (page.status === 'invalid') return <InvalidRepositoriesView message={page.message} />;
  const definition = {
    ...overviewSettingsColumns,
    repositoryIds: samples.repositories.map((row) => row.repository.id),
  };
  const columns = {
    backlogColumns: [...definition.defaultBacklogColumns],
    activityColumns: [...definition.defaultActivityColumns],
  };
  if (!readOverviewValues(page.values, columns, definition, samples.asOf))
    return (
      <InvalidRepositoriesView message="This link names repositories, periods or PR ages All repositories does not offer." />
    );
  return <RepositoriesScreen samples={samples} viewerId={viewer.id} preferences={preferences} />;
}
