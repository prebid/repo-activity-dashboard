import { allRepositories } from '@/server/reporting';
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { InvalidTimeline, TimelineRoute } from '@/app/_screens/timeline-route';
import { timelineEntryValues } from '@/server/timeline-preview';
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
  const snapshot = await readPreferences('repositories');
  const preferences = repositoriesPreferences(snapshot, samples);
  const page = await canonicalPage('/repos', {}, query, {
    saved: (screen, values) =>
      screen === 'summary'
        ? summaryEntryValues(preferences)
        : timelineEntryValues({ route: '/repos', segments: {}, values }, snapshot),
  });
  if (page.status === 'invalid')
    return queryPairs(query).some(([key]) => key === 'timeline') ? (
      <InvalidTimeline message={page.message} href="/repos" />
    ) : (
      <InvalidRepositoriesView message={page.message} />
    );
  if (page.screen !== 'summary')
    return (
      <TimelineRoute
        view={{ route: '/repos', segments: {}, values: page.values }}
        entry={page.entry}
      />
    );
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
