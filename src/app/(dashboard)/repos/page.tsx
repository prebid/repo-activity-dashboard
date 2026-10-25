import { auth } from '@/lib/auth/auth';
import { repositoryCatalog } from '@/config/repositories';
import { repositorySummaries, sampleAsOf } from '@/mocks/reporting';
import { AllRepositoriesView } from '@/features/repositories/all-repositories-view';
import { encodeSearchParams } from '@/lib/presentation/search-params';
export default async function AllReposPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const viewer = await auth();
  const rows = repositorySummaries.map((summary) => {
    const repo = repositoryCatalog.find((r) => r.id === summary.repositoryId)!;
    return { ...summary, id: repo.id, name: repo.displayName, slug: repo.slug };
  });
  return (
    <AllRepositoriesView
      asOf={sampleAsOf}
      viewerId={viewer?.user.id}
      rows={rows}
      initialSearch={encodeSearchParams(await searchParams)}
    />
  );
}
