import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { repositoryCatalog } from '@/config/repositories';
import {
  companyColumns,
  contributorColumns,
  repositoryContributionColumns,
} from '@/features/contributions/contribution-columns';
import { contributionDetailColumnIds } from '@/features/contributions/contribution-details-view';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import { contributionDetailColumns } from '@/features/repositories/repository-insights-view';
import {
  repositoryMergedPrColumns,
  repositoryPageIssueColumns,
  repositoryPagePrColumns,
} from '@/features/repositories/repository-page-columns';
import {
  companyFocus,
  readContributionLayoutQuery,
} from '@/lib/presentation/contribution-navigation';
import { contributionReturnHref } from '@/lib/presentation/contribution-return';
import {
  readContributionPeriod,
  readContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { decodeRouteSegment } from '@/lib/presentation/navigation';
import { resolveOverviewSettings } from '@/lib/presentation/overview-settings';
import { withOverviewSort } from '@/lib/presentation/overview-sort';
import {
  authorListQuery,
  authorRecordSelection,
  isAuthorSelection,
  readAuthorAccountSegment,
} from '@/lib/presentation/repository-author-records';
import { readRepositoryDrilldown } from '@/lib/presentation/repository-drilldown';
import { isInsightSelection } from '@/lib/presentation/repository-insights';
import { repositoryPageDefaultSort } from '@/lib/presentation/repository-page';
import { readRepositoryPageEntry } from '@/lib/presentation/repository-page-entry';
import { readRepositoryFilterValues } from '@/lib/presentation/repository-page-query';
import { repositoryFilterError } from '@/lib/presentation/repository-page-rules';
import { recordListKind } from '@/lib/presentation/repository-records';
import { matrixRepositoryIds } from '@/lib/presentation/repository-timeline-matrix';
import { repositoryMatrixSummaryHref } from '@/lib/presentation/repository-timeline-matrix-entry';
import { resolveTableColumns } from '@/lib/presentation/table-column-preferences';
import type { TableController } from '@/lib/presentation/table-controller';
import { effectiveTableQuery } from '@/lib/presentation/table-query';
import { readTimelineSource, readTimelineView } from '@/lib/presentation/timeline-controls';
import { safeTimelineParent } from '@/lib/presentation/timeline-navigation';
import {
  readTimelineSupportQuery,
  timelineParentQuery,
} from '@/lib/presentation/timeline-support-query';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { additionalMetricIds } from '@/models/contribution-activity';
import { contributionMetricBasis, isReportMetric } from '@/models/contribution-metrics';
import type { ContributionArea } from '@/models/contribution-page';
import type { RecordSelection } from '@/models/repository-records';
import { contributionDefaultSort, type ContributionFocus } from '@/models/contributions';
import { authorTableColumnIds } from '@/models/repository-insights';
import { reportingBranchSchema } from '@/models/repository-overview';
import type { TableQuery } from '@/models/table-query';
import type { TimelineArea } from '@/models/timeline-controls';
import { linkKindParts, stableJson, type GoldenUrls } from '../support/golden-urls';

// Each recorded URL resolved to the state its page renders for a first visit (no saved
// preferences), through the readers that page composes today. The output is the legacy decoder's
// expected state in P5c.

const golden = JSON.parse(
  readFileSync('tests/fixtures/golden/golden-urls.json', 'utf8'),
) as GoldenUrls;
const origin = 'https://dashboard.invalid';
const asOf = contributionSampleAsOf;
const ids = (columns: readonly { id: string }[]) => columns.map((column) => column.id);

const overviewSamples = repositoryOverviewSamples();
const overviewDefinition = {
  ...overviewSettingsColumns,
  repositoryIds: overviewSamples.repositories.map((row) => row.repository.id),
};
const enabledRepositoryIds = repositoryCatalog.filter((row) => row.enabled).map((row) => row.id);

// The column lists and default sorts the report screens pass to their table controllers.
const recordTables = {
  prs: ids(repositoryPagePrColumns),
  issues: ids(repositoryPageIssueColumns),
};
const insightTables = {
  authors: { key: 'authors', columns: authorTableColumnIds, sort: 'recordCount' },
  duration: { key: 'prs', columns: ids(repositoryMergedPrColumns), sort: 'createdAt' },
  contributions: { key: 'credits', columns: ids(contributionDetailColumns), sort: 'firstCreditAt' },
};
const noLinks = { sample: 'reference' as const, currentHref: '/contributors' };
const contributionTables = {
  contributors: ids(contributorColumns(noLinks)),
  companies: ids(companyColumns(noLinks)),
  members: ids(contributorColumns(noLinks, false)),
  repositories: ids(repositoryContributionColumns()),
};
const detailSort = { sort: 'creditedAt', descending: true };

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Visible column IDs when the URL names the table's columns. */
function urlColumns(params: URLSearchParams, kind: string, columnIds: readonly string[]) {
  if (!params.has(kind + '.columns')) return undefined;
  const columns = resolveTableColumns(params.toString(), kind, {}, {}, columnIds);
  return columnIds.filter((id) => columns[id]);
}

function timelineView(params: URLSearchParams, area: TimelineArea) {
  try {
    const { period, exactRange, view } = readTimelineView(params, area, asOf);
    return { period, exactRange, view };
  } catch (error) {
    return { invalid: message(error) };
  }
}

/** Every decoded frame of a contribution return trail, nearest first, each without its own trail. */
function returnTrail(params: URLSearchParams): string[] {
  const frames: string[] = [];
  let current = params;
  // Eight frames at most, plus one read that finds none.
  for (let reads = 0; reads <= 8; reads++) {
    const parent = contributionReturnHref(current, '');
    if (!parent) break;
    const url = new URL(parent, origin);
    current = url.searchParams;
    const shown = new URLSearchParams(current);
    shown.delete('nav');
    frames.push(url.pathname + (shown.size ? '?' + shown.toString() : ''));
  }
  return frames;
}

/** A supporting-record view and the Timeline it was opened from. */
function supportState(url: URL, route: string) {
  const parent = url.pathname + '?' + timelineParentQuery(url.searchParams).toString();
  return {
    support: readTimelineSupportQuery(url.searchParams),
    parent: { href: parent, ...resolve(route, parent) },
  };
}

function overviewState(url: URL) {
  const { value, notice } = resolveOverviewSettings(url.search, null, overviewDefinition, asOf);
  const table = (key: 'backlog' | 'activity') =>
    withOverviewSort(
      {
        query: effectiveTableQuery(url.search, key, overviewSettingsColumns[`${key}Columns`]),
      } as TableController,
      key,
      value,
    ).query;
  return { settings: value, notice, backlog: table('backlog'), activity: table('activity') };
}

function matrixState(url: URL) {
  const params = url.searchParams;
  return {
    source: readTimelineSource(params, 'matrix'),
    timeline: timelineView(params, 'matrix'),
    repositoryIds: matrixRepositoryIds(params, enabledRepositoryIds),
    summary: repositoryMatrixSummaryHref(params.get('summary')),
  };
}

function catalogIdentity(slug: string) {
  const repo = repositoryCatalog.find((row) => row.slug === slug && row.enabled);
  return repo
    ? {
        id: repo.id,
        slug: repo.slug,
        name: repo.displayName,
        primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
      }
    : null;
}

/** Record filters, table and charts of a pull request or issue list. */
function recordListState(params: URLSearchParams, selection: RecordSelection) {
  const kind = recordListKind(selection);
  const values = readRepositoryFilterValues(params.toString(), kind);
  const charts = params.get(kind + '.charts');
  return {
    kind,
    filters: values && !repositoryFilterError(values, selection) ? values : null,
    table: effectiveTableQuery(
      params.toString(),
      kind,
      recordTables[kind],
      repositoryPageDefaultSort,
    ),
    // Column defaults depend on the prepared list, so only URL-named columns are recorded.
    columns: urlColumns(params, kind, recordTables[kind]),
    charts: charts === null ? false : charts !== '0',
  };
}

function repositoryState(url: URL, slug: string) {
  const identity = catalogIdentity(slug);
  if (!identity) return { repository: null };
  const params = url.searchParams;
  if (params.has('timeline')) {
    if (params.has('timeline.detail')) return supportState(url, '/repos/[slug]');
    const timeline = timelineView(params, 'repository');
    const kind = 'invalid' in timeline ? 'prs' : timeline.view.kind;
    return {
      source: readTimelineSource(params, 'repository'),
      timeline,
      filters: readRepositoryFilterValues(params.toString(), kind),
      parent: safeTimelineParent(params.get('timelineParent'), url.pathname),
    };
  }
  const entry = readRepositoryPageEntry(params, identity);
  if (entry.status === 'invalid') return { entry };
  if (entry.status === 'records')
    return { entry, ...recordListState(params, entry.drilldown.selection) };
  const { selection, returnTo } = entry.drilldown;
  if (!isInsightSelection(selection)) return { entry: { status: 'unsupported', returnTo } };
  const insight = isAuthorSelection(selection)
    ? 'authors'
    : selection.metric === 'medianMergeDays'
      ? 'duration'
      : 'contributions';
  const { key, columns, sort } = insightTables[insight];
  return {
    entry,
    insight,
    table: {
      key,
      ...effectiveTableQuery(url.search, key, columns, { sort, descending: true }),
    },
  };
}

function authorState(url: URL, slug: string, segment: string) {
  const identity = catalogIdentity(slug);
  if (!identity) return { repository: null };
  const author = readAuthorAccountSegment(segment);
  const drilldown = readRepositoryDrilldown(url.searchParams, identity);
  if (
    author === null ||
    drilldown.status !== 'valid' ||
    !isAuthorSelection(drilldown.value.selection)
  )
    return { author, drilldown };
  return {
    author,
    drilldown,
    authors: authorListQuery(url.searchParams),
    ...recordListState(url.searchParams, authorRecordSelection(drilldown.value.selection)),
  };
}

function contributionState(
  url: URL,
  route: string,
  area: ContributionArea,
  focus: ContributionFocus | null,
) {
  if (!focus) return { focus };
  const params = url.searchParams;
  const base = { focus, trail: returnTrail(params) };
  if (params.has('timeline')) {
    if (params.has('timeline.detail')) return { ...base, ...supportState(url, route) };
    const source = readTimelineSource(params, 'contribution');
    const sample = source?.sample;
    const directory =
      source &&
      sample !== undefined &&
      sample !== 'mixed' &&
      contributionTimelineSample(sample, source.gap).contributions;
    return {
      ...base,
      source,
      timeline: timelineView(params, 'contribution'),
      scope: directory ? readContributionSettings(params, directory, asOf) : null,
    };
  }
  const layout = readContributionLayoutQuery(params);
  const period = readContributionPeriod(params, asOf);
  const directory = layout && period && contributionSample({ scenario: layout.sample, period });
  const metric = params.get('metric');
  const table =
    metric !== null
      ? 'details'
      : focus.kind === 'overview'
        ? area
        : focus.kind === 'contributor'
          ? 'repositories'
          : (layout?.breakdown ?? 'members');
  const columnIds =
    table !== 'details'
      ? contributionTables[table]
      : metric !== null && isReportMetric(metric) && contributionMetricBasis(metric) === 'comments'
        ? contributionDetailColumnIds
        : contributionDetailColumnIds.filter((id) => id !== 'lastAt');
  const key = table === 'contributors' || table === 'companies' ? 'report' : table;
  const columns = resolveTableColumns(
    params.toString(),
    table,
    Object.fromEntries(additionalMetricIds.map((id) => [id, false])),
    {},
    columnIds,
  );
  const query: TableQuery = effectiveTableQuery(
    params.toString(),
    key,
    columnIds,
    table === 'details' ? detailSort : contributionDefaultSort,
  );
  return {
    ...base,
    layout,
    scope: directory ? readContributionSettings(params, directory, asOf) : null,
    metric,
    table: {
      kind: table,
      key,
      ...query,
      columns: columnIds.filter((id) => columns[id] !== false),
      hideZeroMembers: table === 'members' && params.get('members.zero') === 'hide',
    },
  };
}

/** Dynamic segments by name; a catch-all keeps every remaining segment. */
function routeParams(route: string, pathname: string): Record<string, string[]> {
  const segments = pathname.split('/').filter(Boolean);
  const params: Record<string, string[]> = {};
  route
    .split('/')
    .filter(Boolean)
    .forEach((part, index) => {
      const name = /^\[(?:\.\.\.)?([^\]]+)\]$/.exec(part)?.[1];
      if (name) params[name] = part.startsWith('[...') ? segments.slice(index) : [segments[index]];
    });
  return params;
}

const readers: Record<string, (url: URL, segments: Record<string, string[]>) => object> = {
  '/repos': (url) => (url.searchParams.has('timeline') ? matrixState(url) : overviewState(url)),
  '/repos/[slug]': (url, { slug }) => repositoryState(url, slug[0]),
  '/repos/[slug]/authors/[account]': (url, { slug, account }) =>
    authorState(url, slug[0], account[0]),
  '/contributors': (url) =>
    contributionState(url, '/contributors', 'contributors', { kind: 'overview' }),
  '/companies': (url) => contributionState(url, '/companies', 'companies', { kind: 'overview' }),
  '/contributors/[accountId]': (url, { accountId }) => {
    const id = decodeRouteSegment(accountId[0]);
    return contributionState(
      url,
      '/contributors/[accountId]',
      'contributors',
      id === null ? null : { kind: 'contributor', accountId: id },
    );
  },
  '/companies/[...identity]': (url, { identity }) => {
    const segments = identity.map(decodeRouteSegment);
    return contributionState(
      url,
      '/companies/[...identity]',
      'companies',
      segments.includes(null) ? null : companyFocus(segments as string[]),
    );
  },
};

function resolve(route: string, href: string): { route: string; state: object | 'no reader' } {
  const url = new URL(href, origin);
  const read = readers[route];
  return { route, state: read ? read(url, routeParams(route, url.pathname)) : 'no reader' };
}

it('resolves every golden URL to the state its page renders through the current readers', async () => {
  const states: Record<string, ReturnType<typeof resolve>> = {};
  const add = (route: string, href: string) => (states[href] ??= resolve(route, href));
  for (const view of Object.values(golden.views)) {
    add(view.route, view.requested);
    add(view.route, view.address);
    for (const [kind, link] of Object.entries(view.links))
      add(linkKindParts(kind).route, link.example);
  }
  add('/repos', golden.scopeChange.address);
  await expect(stableJson(states)).toMatchFileSnapshot('../fixtures/golden/golden-url-states.json');
});
