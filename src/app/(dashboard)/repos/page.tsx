import { allRepositories } from '@/server/reporting';
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import { RepositoryTimelineMatrixRoute } from '@/app/_screens/timeline-route';
import { repositoriesPageMetadata } from '@/server/page-metadata';
import { readPreferences } from '@/server/preferences';
import { repositoriesPreferences } from '@/app/_screens/repository-preferences';
import { requireViewer } from '@/lib/auth/viewer';
import { canonicalPage } from '@/server/canonical-page';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return repositoriesPageMetadata(new URLSearchParams(encodeSearchParams(await searchParams)));
}
export default async function AllReposPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  await requireViewer();
  // These screens still read legacy keys: the helper answers nothing until they read codec values.
  await canonicalPage('/repos', {}, await searchParams, { legacyScreens: true });
  const params = new URLSearchParams(encodeSearchParams(await searchParams));
  if (params.has('timeline')) return <RepositoryTimelineMatrixRoute params={params} />;
  const { viewer, samples } = await allRepositories();
  return (
    <RepositoriesScreen
      samples={samples}
      viewerId={viewer.id}
      preferences={repositoriesPreferences(await readPreferences('repositories'), samples)}
    />
  );
}
