import { loadContributionValues } from './contribution-data';
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
  contributionColumnVisibility,
  contributionReportRoute,
} from '@/lib/presentation/contribution-url';
import { resolveBack } from '@/lib/presentation/url/back';
import { instantIso } from '@/lib/presentation/url/period';
import type { UrlValues } from '@/lib/presentation/url/registry';
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
/** The enabled catalog repository a route slug names, or null when the route is not found. */
export function catalogRepository(slug: string) {
  const repo = repositoryCatalog.find((r) => r.slug === slug && r.enabled);
  if (!repo) return null;
  const identity = {
    id: repo.id,
    slug: repo.slug,
    name: repo.displayName,
    primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
  };
  return { repo, identity };
}
async function repositoryContext(slug: string) {
  const viewer = await requireViewer();
  const found = catalogRepository(slug);
  if (!found) notFound();
  return { viewer, ...found };
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
/**
 * One contribution report view from its registry values. `lens=reviewers` answers with the invalid
 * view until the Reviewers report exists (decision C6); a snapshot pin must be the sample's as-of.
 */
export async function contributions(
  area: ContributionArea,
  values: UrlValues = {},
  focus: ContributionFocus = { kind: 'overview' },
) {
  const loaded = await loadContributionValues(area, values, focus);
  if (loaded.status === 'invalid') return loaded;
  const { viewer, options, source, settings } = loaded;
  const metric = typeof values.metric === 'string' ? values.metric : null;
  const { route, segments } = contributionReportRoute(area, focus);
  if (
    (metric !== null && !isReportMetric(metric)) ||
    values.lens === 'reviewers' ||
    (typeof values.at === 'string' && instantIso(values.at) !== source.asOf) ||
    // `cols` naming a column this table lacks.
    (values.cols !== undefined && contributionColumnVisibility(route, values) === null)
  )
    return { status: 'invalid' as const, viewer, area };
  const presentation = selectContributionPresentation(
    source,
    settings.selection,
    focus,
    metric ?? undefined,
    { area, breakdown: options.breakdown },
  );
  const [parent] = resolveBack({ route, segments, values });
  const page: ContributionPage = {
    area,
    sample: options.sample,
    breakdown: options.breakdown,
    ...presentation,
    returnTo: parent?.available ? parent.href : null,
  };
  return {
    status: 'ready' as const,
    viewer,
    page,
    directory: {
      repositories: source.repositories,
    },
  };
}
