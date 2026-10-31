import { allRepositories } from '@/server/reporting';
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import { RepositoryTimelineMatrixRoute } from '@/app/_screens/timeline-route';
export default async function AllReposPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = new URLSearchParams(encodeSearchParams(await searchParams));
  if (params.has('timeline')) return <RepositoryTimelineMatrixRoute params={params} />;
  const { viewer, samples } = await allRepositories();
  return <RepositoriesScreen samples={samples} viewerId={viewer.id} />;
}
