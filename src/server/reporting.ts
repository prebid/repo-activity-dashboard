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
import { isInsightSelection } from '@/lib/presentation/repository-insights';
import { repositoryInsightSample, repositoryAuthorRecordSample } from '@/mocks/repository-insights';
import {
  isAuthorSelection,
  readAuthorAccountSegment,
  authorListQuery,
  repositoryAuthorsHref,
} from '@/lib/presentation/repository-author-records';
export async function allRepositories() {
  const viewer = await requireViewer();
  return { viewer, samples: repositoryOverviewSamples() };
}
async function repositoryContext(slug: string) {
  const viewer = await requireViewer();
  const repo = repositoryCatalog.find((r) => r.slug === slug && r.enabled);
  if (!repo) notFound();
  const identity = {
    id: repo.id,
    slug: repo.slug,
    name: repo.displayName,
    primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
  };
  return { viewer, repo, identity };
}
export async function repositoryDetail(slug: string, params = new URLSearchParams()) {
  const { viewer, repo, identity } = await repositoryContext(slug);
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
  if (isInsightSelection(selection))
    return {
      ...base,
      status: 'insight' as const,
      insight: repositoryInsightSample(identity, { selection, returnTo }),
    };
  if (!isRecordSelection(selection)) return { ...base, status: 'unsupported' as const, returnTo };
  return {
    ...base,
    status: 'list' as const,
    list: repositoryRecordSample(identity, { selection, returnTo }),
  };
}
export async function repositoryAuthorDetail(
  slug: string,
  accountSegment: string,
  params: URLSearchParams,
) {
  const { viewer, identity } = await repositoryContext(slug);
  const author = readAuthorAccountSegment(accountSegment);
  const parsed = readRepositoryDrilldown(params, identity);
  if (author === null || parsed.status !== 'valid' || !isAuthorSelection(parsed.value.selection))
    return { status: 'invalid' as const };
  const drilldown = { selection: parsed.value.selection, returnTo: parsed.value.returnTo };
  const returnToAuthors = repositoryAuthorsHref(identity, drilldown, authorListQuery(params));
  return {
    status: 'list' as const,
    viewer,
    list: repositoryAuthorRecordSample(identity, drilldown, author, returnToAuthors),
  };
}
export async function contributions(kind: 'contributors' | 'companies') {
  const viewer = await requireViewer();
  return { viewer, rows: kind === 'contributors' ? contributionRows : companyRows };
}
