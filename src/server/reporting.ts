import { loadContributionValues } from './contribution-data';
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
import {
  contributionColumnVisibility,
  contributionReportRoute,
} from '@/lib/presentation/contribution-url';
import { instantIso } from '@/lib/presentation/url/period';
import type { ContributionFocus } from '@/models/contributions';
import type { ContributionArea, ContributionPage } from '@/models/contribution-page';
import type { ContributionLens } from '@/models/contribution-lens';
import { contributionBackLabel } from '@/lib/presentation/contribution-lens';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { readDrilldownSelection, summaryReturnTo } from '@/lib/presentation/repository-drilldown';
import { reportingBranchSchema } from '@/models/repository-overview';
import { isInsightSelection } from '@/lib/presentation/repository-insights';
import { isRecordSelection } from '@/lib/presentation/repository-records';
import { repositoryInsightSample, repositoryAuthorRecordSample } from '@/mocks/repository-insights';
import { repositoryRecords } from './activity-database';
import { isAuthorSelection } from '@/lib/presentation/repository-author-records';
import { resolveBack, type UrlView } from '@/lib/presentation/url/back';
import { columnTableOf, visibleColumns } from '@/lib/presentation/url/defaults';
import type { UrlValues } from '@/lib/presentation/url/registry';
export async function allRepositories() {
  const viewer = await requireViewer();
  return { viewer, samples: repositoryOverviewSamples(repositoryRecords()) };
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
  const records = repositoryRecords();
  const view: UrlView = { route: '/repos/[slug]', segments: { slug: [identity.slug] }, values };
  const selection = readDrilldownSelection(values, identity, records.asOf);
  const navigation = repositoryPageNavigationSample(identity, records);
  if (!selection || !knownColumns(view)) return { status: 'invalid' as const };
  const returnTo = summaryReturnTo(view);
  if (isInsightSelection(selection))
    return {
      status: 'insight' as const,
      viewer,
      repo,
      navigation,
      insight: repositoryInsightSample(identity, { selection, returnTo }, records),
    };
  if (!isRecordSelection(selection)) return { status: 'invalid' as const };
  return {
    status: 'page' as const,
    viewer,
    navigation,
    source: repositoryPageSample(identity, { selection, returnTo }, records),
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
  const records = repositoryRecords();
  const selection = readDrilldownSelection(values, identity, records.asOf);
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
    navigation: repositoryPageNavigationSample(identity, records),
    source: repositoryPageRecordsSample(
      repositoryAuthorRecordSample(
        identity,
        { selection, returnTo: summaryReturnTo(view) },
        account,
        list.href,
        records,
      ),
      records,
    ),
  };
}
/**
 * One contribution report view from its registry values, in a lens: `lens` names the Reviewers
 * lens of /reviewers, whose route is the lens; elsewhere `values.lens` decides. Show all (`all`)
 * belongs to a Reviewers-lens overview's table; a snapshot pin must be the sample's as-of.
 */
export async function contributions(
  area: ContributionArea,
  values: UrlValues = {},
  focus: ContributionFocus = { kind: 'overview' },
  lens: ContributionLens = values.lens === 'reviewers' ? 'reviewers' : 'contributors',
) {
  const loaded = await loadContributionValues(area, values, focus);
  if (loaded.status === 'invalid') return loaded;
  const { viewer, options, source, settings } = loaded;
  const metric = typeof values.metric === 'string' ? values.metric : null;
  const { route, segments } = contributionReportRoute(area, focus, lens);
  const allAccounts = values.all === true;
  if (
    (metric !== null && !isReportMetric(metric)) ||
    (allAccounts && (lens !== 'reviewers' || focus.kind !== 'overview' || metric !== null)) ||
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
    { area, breakdown: options.breakdown, lens, allAccounts },
  );
  const [parent] = resolveBack({ route, segments, values });
  const page: ContributionPage = {
    area,
    sample: options.sample,
    breakdown: options.breakdown,
    ...presentation,
    returnTo: parent?.available ? parent.href : null,
    lens,
    ...(parent && { returnLabel: contributionBackLabel(parent.available ? parent.view : null) }),
    ...(allAccounts && { allAccounts }),
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
