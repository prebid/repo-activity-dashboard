import { repositoryDetail } from '@/server/reporting';
import { RepositoryScreen } from '@/app/_screens/repository-screen';
import { firstSearchParam, type PageSearchParams } from '@/lib/presentation/search-params';
export default async function RepositoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { viewer, repo, sample } = await repositoryDetail(slug);
  const threshold = Number(firstSearchParam(query.age));
  const age = [30, 60, 90, 120, 180, 360].includes(threshold) ? threshold : null;
  return (
    <RepositoryScreen
      name={repo.displayName}
      slug={slug}
      {...sample}
      view={firstSearchParam(query.view) === 'issues' ? 'issues' : 'prs'}
      age={age}
      viewerId={viewer.id}
    />
  );
}
