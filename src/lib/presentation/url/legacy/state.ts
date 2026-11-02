// The state each report page renders for a legacy (pre-codec) URL on a first visit, resolved
// through the frozen readers the pages composed when the golden URL set was recorded (P5a). The
// legacy decoder reads it; `tests/unit/golden-urls.test.ts` pins it to the recorded states.
import type { ContributionDirectory } from '@/models/contribution-settings';
import type { ContributionArea, ContributionSampleScenario } from '@/models/contribution-page';
import type { OverviewSettingsDefinition } from '@/models/overview-settings';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RecordSelection } from '@/models/repository-records';
import type { TableQuery } from '@/models/table-query';
import type { TimelineArea } from '@/models/timeline-controls';
import type { PeriodSelection } from '@/models/reporting-period';
import { contributionDefaultSort, type ContributionFocus } from '@/models/contributions';
import { additionalMetricIds } from '@/models/contribution-activity';
import { contributionMetricBasis, isReportMetric } from '@/models/contribution-metrics';
import { contributionReturnHref } from '../../contribution-return';
import { decodeRouteSegment } from '../../navigation';
import type { TableController } from '../../table-controller';
import { authorRecordSelection, isAuthorSelection } from '../../repository-author-records';
import { isInsightSelection } from '../../repository-insights';
import { repositoryPageDefaultSort } from '../../repository-page';
import { repositoryFilterError } from '../../repository-page-rules';
import { recordListKind } from '../../repository-records';
import { resolveOverviewSettings, repositoryMatrixSummaryHref, withOverviewSort } from './overview';
import {
  authorListQuery,
  readAuthorAccountSegment,
  readRepositoryDrilldown,
  readRepositoryFilterValues,
  readRepositoryPageEntry,
} from './repository';
import { effectiveTableQuery } from './table-query';
import { resolveTableColumns } from './table-columns';
import {
  matrixRepositoryIds,
  readTimelineSource,
  readTimelineSupportQuery,
  readTimelineView,
  safeTimelineParent,
  timelineParentQuery,
} from './timeline';
import {
  companyFocus,
  readContributionLayoutQuery,
  readContributionPeriod,
  readContributionSettings,
} from './contribution';

/** What the legacy readers need besides the URL: catalog, column lists and sample directories. */
export interface LegacyContext {
  /** The reporting as-of every period resolves against. */
  readonly asOf: string;
  readonly enabledRepositoryIds: readonly string[];
  /** The enabled catalog repository with a slug, or null. */
  catalogIdentity(slug: string): OverviewRepository | null;
  /** All repositories settings columns and the sample's repository IDs. */
  readonly overviewDefinition: OverviewSettingsDefinition;
  /** Column IDs of the record, insight, contribution and details tables. */
  readonly columnIds: LegacyColumnIds;
  /** The contribution directory a report period resolves to, or null when none is prepared. */
  contributionDirectory(
    sample: ContributionSampleScenario,
    period: PeriodSelection,
  ): ContributionDirectory | null;
  /** The contribution directory of a Timeline sample and gap variant. */
  contributionTimelineDirectory(
    sample: ContributionSampleScenario,
    gap: boolean,
  ): ContributionDirectory;
}
export interface LegacyColumnIds {
  readonly prs: readonly string[];
  readonly issues: readonly string[];
  readonly authors: readonly string[];
  readonly mergedPrs: readonly string[];
  readonly credits: readonly string[];
  readonly contributors: readonly string[];
  readonly companies: readonly string[];
  readonly members: readonly string[];
  readonly repositories: readonly string[];
  readonly details: readonly string[];
}
export type LegacyState = object | 'no reader';

const origin = 'https://dashboard.invalid';
const detailSort = { sort: 'creditedAt', descending: true };

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Every reader the legacy pages composed, bound to one context. */
function readers(context: LegacyContext) {
  const { asOf } = context;
  const insightTables = {
    authors: { key: 'authors', columns: context.columnIds.authors, sort: 'recordCount' },
    duration: { key: 'prs', columns: context.columnIds.mergedPrs, sort: 'createdAt' },
    contributions: { key: 'credits', columns: context.columnIds.credits, sort: 'firstCreditAt' },
  };

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
    const { value, notice } = resolveOverviewSettings(
      url.search,
      null,
      context.overviewDefinition,
      asOf,
    );
    const table = (key: 'backlog' | 'activity') =>
      withOverviewSort(
        {
          query: effectiveTableQuery(url.search, key, context.overviewDefinition[`${key}Columns`]),
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
      repositoryIds: matrixRepositoryIds(params, context.enabledRepositoryIds),
      summary: repositoryMatrixSummaryHref(params.get('summary')),
    };
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
        context.columnIds[kind],
        repositoryPageDefaultSort,
      ),
      // Column defaults depend on the prepared list, so only URL-named columns are recorded.
      columns: urlColumns(params, kind, context.columnIds[kind]),
      charts: charts === null ? false : charts !== '0',
    };
  }

  function repositoryState(url: URL, slug: string) {
    const identity = context.catalogIdentity(slug);
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
    const identity = context.catalogIdentity(slug);
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
        context.contributionTimelineDirectory(sample, source.gap);
      return {
        ...base,
        source,
        timeline: timelineView(params, 'contribution'),
        scope: directory ? readContributionSettings(params, directory, asOf) : null,
      };
    }
    const layout = readContributionLayoutQuery(params);
    const period = readContributionPeriod(params, asOf);
    const directory = layout && period && context.contributionDirectory(layout.sample, period);
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
        ? context.columnIds[table]
        : metric !== null &&
            isReportMetric(metric) &&
            contributionMetricBasis(metric) === 'comments'
          ? context.columnIds.details
          : context.columnIds.details.filter((id) => id !== 'lastAt');
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

  const byRoute: Record<string, (url: URL, segments: Record<string, string[]>) => object> = {
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

  function resolve(route: string, href: string): { route: string; state: LegacyState } {
    const url = new URL(href, origin);
    const read = byRoute[route];
    return { route, state: read ? read(url, routeParams(route, url.pathname)) : 'no reader' };
  }
  return resolve;
}

/** Dynamic segments by name, still percent-encoded; a catch-all keeps every remaining segment. */
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

/**
 * The state a route's page renders for a legacy href on a first visit (no saved preferences), or
 * 'no reader' for a route outside the report pages.
 */
export function legacyState(
  route: string,
  href: string,
  context: LegacyContext,
): { route: string; state: LegacyState } {
  return readers(context)(route, href);
}
