import { loadContributionData } from './contribution-data';
import { isReportMetric } from '@/models/contribution-metrics';
import { readRepositoryPageEntry } from '@/lib/presentation/repository-page-entry';
import {
  repositoryPageSample,
  repositoryPageRecordsSample,
  repositoryPageNavigationSample,
} from '@/mocks/repository-page';
import 'server-only';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { repositoryCatalog } from '@/config/repositories';
import { selectContributionPresentation } from '@/lib/presentation/contributions';
import {
  contributionHref,
  safeContributionReturn,
} from '@/lib/presentation/contribution-navigation';
import type { ContributionFocus } from '@/models/contributions';
import type { ContributionArea, ContributionPage } from '@/models/contribution-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { readRepositoryDrilldown } from '@/lib/presentation/repository-drilldown';
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
  const entry = readRepositoryPageEntry(params, identity);
  const navigation = repositoryPageNavigationSample(identity);
  if (entry.status === 'invalid') return { status: 'invalid' as const };
  if (entry.status === 'records')
    return {
      status: 'page' as const,
      viewer,
      navigation,
      source: repositoryPageSample(identity, entry.drilldown),
    };
  const { selection, returnTo } = entry.drilldown;
  if (isInsightSelection(selection))
    return {
      status: 'insight' as const,
      viewer,
      repo,
      navigation,
      insight: repositoryInsightSample(identity, { selection, returnTo }),
    };
  return { status: 'unsupported' as const, returnTo };
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
    navigation: repositoryPageNavigationSample(identity),
    source: repositoryPageRecordsSample(
      repositoryAuthorRecordSample(identity, drilldown, author, returnToAuthors),
    ),
  };
}
export async function contributions(
  area: ContributionArea,
  params = new URLSearchParams(),
  focus: ContributionFocus = { kind: 'overview' },
) {
  const loaded = await loadContributionData(area, params, focus);
  if (loaded.status === 'invalid') return loaded;
  const { viewer, options, source, settings } = loaded;
  const metric = params.get('metric');
  if (metric !== null && !isReportMetric(metric))
    return { status: 'invalid' as const, viewer, area };
  const presentation = selectContributionPresentation(
    source,
    settings.selection,
    focus,
    metric ?? undefined,
  );
  const page: ContributionPage = {
    area,
    sample: options.sample,
    breakdown: options.breakdown,
    ...presentation,
    returnTo: safeContributionReturn(
      params.get('returnTo'),
      contributionHref(area, options.sample, undefined, options.actorTypes, settings),
    ),
  };
  return {
    status: 'ready' as const,
    viewer,
    page,
    directory: {
      accounts: source.accounts,
      companies: source.companies,
      repositories: source.repositories,
    },
  };
}
