import { loadContributionData } from './contribution-data';
import { isReportMetric } from '@/models/contribution-metrics';
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
import { contributionHref } from '@/lib/presentation/contribution-navigation';
import { contributionReturnHref } from '@/lib/presentation/contribution-return';
import type { ContributionFocus } from '@/models/contributions';
import type { ContributionArea, ContributionPage } from '@/models/contribution-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { readDrilldownSelection, summaryReturnTo } from '@/lib/presentation/repository-drilldown';
import { reportingBranchSchema } from '@/models/repository-overview';
import { isInsightSelection } from '@/lib/presentation/repository-insights';
import { isRecordSelection } from '@/lib/presentation/repository-records';
import { repositoryInsightSample, repositoryAuthorRecordSample } from '@/mocks/repository-insights';
import { overviewAsOf } from '@/mocks/sample-clock';
import { isAuthorSelection } from '@/lib/presentation/repository-author-records';
import { resolveBack, type UrlView } from '@/lib/presentation/url/back';
import { columnTableOf, visibleColumns } from '@/lib/presentation/url/defaults';
import type { UrlValues } from '@/lib/presentation/url/registry';
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
/** Whether a view's `cols` names only columns its table has; a table without `cols` has none. */
function knownColumns(view: UrlView): boolean {
  if (view.values.cols === undefined) return true;
  const table = columnTableOf(view.route, view.values);
  return table !== null && visibleColumns(table, view.values.cols as string[]) !== null;
}
/**
 * A repository list or insight from its canonical values (the page helper has answered legacy
 * links). Invalid when the values select no drilldown or name a column the table lacks.
 */
export async function repositoryDetail(slug: string, values: UrlValues = {}) {
  const { viewer, repo, identity } = await repositoryContext(slug);
  const view: UrlView = { route: '/repos/[slug]', segments: { slug: [identity.slug] }, values };
  const selection = readDrilldownSelection(values, identity, overviewAsOf);
  const navigation = repositoryPageNavigationSample(identity);
  if (!selection || !knownColumns(view)) return { status: 'invalid' as const };
  const returnTo = summaryReturnTo(view);
  if (isInsightSelection(selection))
    return {
      status: 'insight' as const,
      viewer,
      repo,
      navigation,
      insight: repositoryInsightSample(identity, { selection, returnTo }),
    };
  if (!isRecordSelection(selection)) return { status: 'invalid' as const };
  return {
    status: 'page' as const,
    viewer,
    navigation,
    source: repositoryPageSample(identity, { selection, returnTo }),
  };
}

/**
 * One author's records from an author list, from canonical values. `account` is the decoded route
 * segment, or null when it is not an account. The page returns to its author list, which keeps the
 * list's search, sort, page and return context.
 */
export async function repositoryAuthorDetail(
  slug: string,
  account: string | null,
  values: UrlValues,
) {
  const { viewer, identity } = await repositoryContext(slug);
  const selection = readDrilldownSelection(values, identity, overviewAsOf);
  if (account === null || !selection || !isAuthorSelection(selection))
    return { status: 'invalid' as const };
  const view: UrlView = {
    route: '/repos/[slug]/authors/[account]',
    segments: { slug: [identity.slug], account: [account] },
    values,
  };
  const [list] = resolveBack(view);
  if (!knownColumns(view) || !list?.available) return { status: 'invalid' as const };
  return {
    status: 'list' as const,
    viewer,
    navigation: repositoryPageNavigationSample(identity),
    source: repositoryPageRecordsSample(
      repositoryAuthorRecordSample(
        identity,
        { selection, returnTo: summaryReturnTo(view) },
        account,
        list.href,
      ),
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
    { area, breakdown: options.breakdown },
  );
  const page: ContributionPage = {
    area,
    sample: options.sample,
    breakdown: options.breakdown,
    ...presentation,
    returnTo: contributionReturnHref(
      params,
      contributionHref(area, options.sample, undefined, settings) ?? '/' + area,
    ),
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
