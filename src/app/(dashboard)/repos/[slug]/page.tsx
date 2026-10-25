import { notFound } from 'next/navigation';
import { repositoryCatalog } from '@/config/repositories';
import { repositorySample } from '@/mocks/reporting';
import { RepositoryView } from '@/features/repositories/repository-view';
import { encodeSearchParams } from '@/lib/presentation/search-params';
export default async function RepositoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const repo = repositoryCatalog.find((r) => r.slug === slug && r.enabled);
  if (!repo) notFound();
  const sample = repositorySample(repo.id);
  const threshold = Number(query.age);
  const age = [30, 60, 90, 120, 180, 360].includes(threshold) ? threshold : null;
  return (
    <RepositoryView
      name={repo.displayName}
      slug={slug}
      {...sample}
      view={query.view === 'issues' ? 'issues' : 'prs'}
      age={age}
      initialSearch={encodeSearchParams(query)}
    />
  );
}
