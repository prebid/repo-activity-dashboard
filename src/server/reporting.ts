import 'server-only';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { repositoryCatalog } from '@/config/repositories';
import {
  repositorySummaries,
  sampleAsOf,
  repositorySample,
  contributionRows,
  companyRows,
} from '@/mocks/reporting';
import { formatAsOf } from '@/lib/presentation/format';
export async function allRepositories() {
  const viewer = await requireViewer();
  const rows = repositorySummaries.map((summary) => {
    const repo = repositoryCatalog.find((r) => r.id === summary.repositoryId);
    if (!repo) throw new Error('Sample references an unknown repository');
    return { ...summary, id: repo.id, name: repo.displayName, slug: repo.slug };
  });
  return { viewer, rows, asOfLabel: formatAsOf(sampleAsOf) };
}
export async function repositoryDetail(slug: string) {
  const viewer = await requireViewer();
  const repo = repositoryCatalog.find((r) => r.slug === slug && r.enabled);
  if (!repo) notFound();
  return { viewer, repo, sample: repositorySample(repo.id) };
}
export async function contributions(kind: 'contributors' | 'companies') {
  const viewer = await requireViewer();
  return { viewer, rows: kind === 'contributors' ? contributionRows : companyRows };
}
