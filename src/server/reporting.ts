import 'server-only';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { repositoryCatalog } from '@/config/repositories';
import { repositorySample, contributionRows, companyRows } from '@/mocks/reporting';
import { repositoryOverviewSample } from '@/mocks/repository-overview';
export async function allRepositories() {
  const viewer = await requireViewer();
  return { viewer, data: repositoryOverviewSample() };
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
