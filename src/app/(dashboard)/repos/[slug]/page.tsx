import { notFound } from 'next/navigation';
import { repositoryCatalog } from '@/config/repositories';
import { repositorySample } from '@/mocks/reporting';
import { RepositoryView } from '@/features/repositories/repository-view';
import {
  encodeSearchParams,
  firstSearchParam,
  type PageSearchParams,
} from '@/lib/presentation/search-params';
export default async function RepositoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const repo = repositoryCatalog.find((r) => r.slug === slug && r.enabled);
  if (!repo) notFound();
  const sample = repositorySample(repo.id);
  const threshold = Number(firstSearchParam(query.age));
  const age = [30, 60, 90, 120, 180, 360].includes(threshold) ? threshold : null;
  return (
    <RepositoryView
      name={repo.displayName}
      slug={slug}
      {...sample}
      view={firstSearchParam(query.view) === 'issues' ? 'issues' : 'prs'}
      age={age}
      initialSearch={encodeSearchParams(query)}
    />
  );
}
