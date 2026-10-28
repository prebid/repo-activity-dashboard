import 'server-only';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { repositoryCatalog } from '@/config/repositories';
import { repositorySample, contributionRows, companyRows } from '@/mocks/reporting';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { repositoryRecordSample } from '@/mocks/repository-records';
import { readRepositoryDrilldown } from '@/lib/presentation/repository-drilldown';
import { isRecordSelection } from '@/lib/presentation/repository-records';
import { reportingBranchSchema } from '@/models/repository-overview';
export async function allRepositories() {
  const viewer = await requireViewer();
  return { viewer, samples: repositoryOverviewSamples() };
}
export async function repositoryDetail(slug: string, params = new URLSearchParams()) {
  const viewer = await requireViewer();
  const repo = repositoryCatalog.find((r) => r.slug === slug && r.enabled);
  if (!repo) notFound();
  const identity = {
    id: repo.id,
    slug: repo.slug,
    name: repo.displayName,
    primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
  };
  const parsed = readRepositoryDrilldown(params, identity);
  const base = { viewer, repo };
  if (parsed.status === 'invalid') return { ...base, status: 'invalid' as const };
  if (parsed.status === 'none')
    return {
      ...base,
      status: 'current' as const,
      sample: repositorySample(repo.id),
      returnTo: params.get('returnTo') ?? '/repos',
    };
  const { selection, returnTo } = parsed.value;
  if (!isRecordSelection(selection)) return { ...base, status: 'unsupported' as const, returnTo };
  return {
    ...base,
    status: 'list' as const,
    list: repositoryRecordSample(identity, { selection, returnTo }),
  };
}
export async function contributions(kind: 'contributors' | 'companies') {
  const viewer = await requireViewer();
  return { viewer, rows: kind === 'contributors' ? contributionRows : companyRows };
}
