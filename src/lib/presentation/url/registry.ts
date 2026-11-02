// The URL parameter registry (architecture rule 6): every report route, the screens each route
// renders, and every query parameter with its encoding, domain and serialization order.
import { periodPresets } from '@/models/reporting-period';
import { timelineGroupings } from '@/models/reporting-timeline';
import { reviewBuckets, latestActorCategories } from '@/models/repository-page';
import { contributionActorTypes } from '@/models/contributions';
import { contributionSampleScenarios } from '@/models/contribution-page';
import { insightMetrics } from '@/models/repository-insights';

export const urlRoutes = [
  '/repos',
  '/repos/[slug]',
  '/repos/[slug]/authors/[account]',
  '/contributors',
  '/contributors/[accountId]',
  '/companies',
  '/companies/[...identity]',
  '/reviewers',
  '/contributors/export',
  '/companies/export',
] as const;
export type UrlRoute = (typeof urlRoutes)[number];
/** Decoded dynamic segments by name; a catch-all keeps every remaining segment. */
export type UrlSegments = Readonly<Record<string, readonly string[]>>;
export type ReportRoute = Exclude<UrlRoute, '/contributors/export' | '/companies/export'>;

/**
 * `list`: an area's top-level report, where saved scope and presentation apply on an entry.
 * `detail`: a page about one subject, where only saved presentation applies (decision C2).
 * `export`: a file download, never redirected and never reading a cookie.
 */
export type RouteKind = 'list' | 'detail' | 'export';
export const routeKinds: Readonly<Record<UrlRoute, RouteKind>> = {
  '/repos': 'list',
  '/repos/[slug]': 'detail',
  '/repos/[slug]/authors/[account]': 'detail',
  '/contributors': 'list',
  '/contributors/[accountId]': 'detail',
  '/companies': 'list',
  '/companies/[...identity]': 'detail',
  '/reviewers': 'list',
  '/contributors/export': 'export',
  '/companies/export': 'export',
};
export type UrlArea = 'repositories' | 'contributions';
export function routeArea(route: UrlRoute): UrlArea {
  return route.startsWith('/repos') ? 'repositories' : 'contributions';
}

export const urlScreens = [
  'summary',
  'matrix',
  'records',
  'insight',
  'authorRecords',
  'repositoryTimeline',
  'contributionOverview',
  'contributionDetail',
  'contributionTimeline',
  'support',
  'export',
] as const;
export type UrlScreen = (typeof urlScreens)[number];
export type TimelineScreen = 'matrix' | 'repositoryTimeline' | 'contributionTimeline';

/** The Timeline a route's `?timeline` view is; a supporting view inherits its parameters. */
export function timelineScreen(route: UrlRoute): TimelineScreen {
  return route === '/repos'
    ? 'matrix'
    : route.startsWith('/repos/')
      ? 'repositoryTimeline'
      : 'contributionTimeline';
}

export type UrlValue = string | readonly string[] | true;
export type UrlValues = Readonly<Record<string, UrlValue>>;

/** The screen a route renders for its values: selectors and the drilldown metric decide it. */
export function screenOf(route: UrlRoute, values: UrlValues): UrlScreen {
  if (routeKinds[route] === 'export') return 'export';
  if (route === '/repos/[slug]/authors/[account]') return 'authorRecords';
  if (values.timeline === true) return 'detail' in values ? 'support' : timelineScreen(route);
  if (route === '/repos') return 'summary';
  if (route === '/repos/[slug]')
    return typeof values.metric === 'string' &&
      (insightMetrics as readonly string[]).includes(values.metric)
      ? 'insight'
      : 'records';
  return routeKinds[route] === 'list' ? 'contributionOverview' : 'contributionDetail';
}

/**
 * - `flag`: a bare key (`?timeline`), written without `=`.
 * - `enum`, `text`, `int` (1 or more), `version`: one value.
 * - `list`: comma-joined items (decision C7); `key=` is an explicit empty list.
 * - `textList`: free text that may hold a comma, so one repeated key per item (C7).
 * - `period`: a preset ID or `YYYY-MM-DD..YYYY-MM-DD`.
 * - `instant`: `YYYY-MM-DD`, `YYYY-MM-DDTHH:MMZ`, `…:SSZ` or a full ISO instant, all UTC.
 * - `sort`: `id` ascending, `-id` descending. `cols`: `id` shows and `-id` hides a column.
 * - `interval`: `<grouping>:<instant>`. `snap`: `<revision>@<instant>`.
 * - `frames`: repeated `back` values (return context).
 */
export type UrlKind =
  | 'flag'
  | 'enum'
  | 'text'
  | 'int'
  | 'version'
  | 'list'
  | 'textList'
  | 'period'
  | 'instant'
  | 'sort'
  | 'cols'
  | 'interval'
  | 'snap'
  | 'frames';
/** Serialization order: selectors, scope, drilldown, filters, presentation, support, return, v. */
export const urlDomains = [
  'selector',
  'scope',
  'drilldown',
  'filter',
  'presentation',
  'support',
  'return',
  'version',
] as const;
export type UrlDomain = (typeof urlDomains)[number];

export interface UrlParam {
  readonly name: string;
  readonly kind: UrlKind;
  readonly domain: UrlDomain;
  readonly screens: readonly UrlScreen[];
  /** Allowed values of an `enum`, or of each `list` item. */
  readonly values?: readonly string[];
  /** Routes that do not accept the parameter although they render one of its screens. */
  readonly exceptRoutes?: readonly UrlRoute[];
}

const repositoryTimelines = ['matrix', 'repositoryTimeline'] as const;
const timelines = [...repositoryTimelines, 'contributionTimeline'] as const;
const contributionScopes = [
  'contributionOverview',
  'contributionDetail',
  'contributionTimeline',
  'export',
] as const;
const recordLists = ['records', 'authorRecords', 'repositoryTimeline'] as const;
const reportScreens = urlScreens.filter((screen) => screen !== 'export');
const tables = [
  'records',
  'insight',
  'authorRecords',
  'repositoryTimeline',
  'matrix',
  'contributionOverview',
  'contributionDetail',
  'contributionTimeline',
  'export',
] as const;
const sampleScenarios = contributionSampleScenarios as readonly string[];
const yesNo = ['yes', 'no', 'unknown'];
const param = (
  name: string,
  kind: UrlKind,
  domain: UrlDomain,
  screens: readonly UrlScreen[],
  extra: Partial<Pick<UrlParam, 'values' | 'exceptRoutes'>> = {},
): UrlParam => ({ name, kind, domain, screens, ...extra });
const filter = (name: string, kind: UrlKind, values?: readonly string[]) =>
  param(name, kind, 'filter', recordLists, values ? { values } : {});

/** Every parameter, in serialization order within its domain. A name may have one entry per screen set. */
export const urlParams: readonly UrlParam[] = [
  // Selectors: which view of a route.
  param('timeline', 'flag', 'selector', [...timelines, 'support']),
  param('view', 'enum', 'selector', ['records', 'repositoryTimeline'], {
    values: ['prs', 'issues'],
  }),
  param('view', 'enum', 'selector', ['contributionDetail', 'export'], {
    values: ['members', 'repositories'],
  }),
  param('lens', 'enum', 'selector', contributionScopes, {
    values: ['contributors', 'reviewers'],
    exceptRoutes: ['/contributors', '/reviewers'],
  }),
  param('sample', 'enum', 'selector', repositoryTimelines, {
    values: [...sampleScenarios, 'mixed'],
  }),
  param('sample', 'enum', 'selector', contributionScopes, { values: sampleScenarios }),
  param('gap', 'flag', 'selector', timelines),
  // Scope: which records a report counts.
  param('repo', 'list', 'scope', ['summary', 'matrix', ...contributionScopes]),
  param('period', 'period', 'scope', [
    'summary',
    'matrix',
    'records',
    'insight',
    'authorRecords',
    'repositoryTimeline',
    ...contributionScopes,
  ]),
  param('period2', 'period', 'scope', ['summary']),
  param('at', 'instant', 'scope', [
    'records',
    'insight',
    'authorRecords',
    ...timelines,
    'contributionOverview',
    'contributionDetail',
  ]),
  param('age', 'list', 'scope', ['summary']),
  param('type', 'list', 'scope', contributionScopes, { values: contributionActorTypes }),
  param('account', 'list', 'scope', contributionScopes),
  param('company', 'list', 'scope', contributionScopes),
  param('exclude', 'list', 'scope', contributionScopes),
  // Drilldown: the metric a page lists, and its age bucket.
  param('metric', 'list', 'drilldown', ['matrix']),
  param('metric', 'text', 'drilldown', [
    'records',
    'insight',
    'authorRecords',
    'repositoryTimeline',
    'contributionOverview',
    'contributionDetail',
  ]),
  param('age', 'int', 'drilldown', ['records']),
  // Record filters.
  filter('authors', 'list'),
  filter('authorTypes', 'list', contributionActorTypes),
  filter('states', 'list', ['Open', 'Merged', 'Closed']),
  filter('latestActors', 'list', latestActorCategories),
  filter('assignees', 'list'),
  filter('labels', 'textList'),
  filter('branches', 'textList'),
  filter('draft', 'enum', ['all', 'drafts', 'non-drafts']),
  filter('assignment', 'enum', ['any', 'assigned', 'unassigned', 'unknown']),
  filter('ageBand', 'enum', ['0', '30', '60', '90', '120', '180', '360']),
  filter('reviewers', 'enum', reviewBuckets),
  filter('approvals', 'enum', reviewBuckets),
  filter('agentReviewer', 'enum', yesNo),
  filter('botReviewer', 'enum', yesNo),
  filter('events', 'period'),
  // Presentation: how the primary table and charts show the records.
  param('rank', 'text', 'presentation', ['matrix']),
  param('group', 'enum', 'presentation', timelines, { values: timelineGroupings }),
  param('family', 'enum', 'presentation', ['repositoryTimeline'], {
    values: ['activity', 'snapshot'],
  }),
  param('chart', 'flag', 'presentation', ['repositoryTimeline']),
  param('omitted', 'flag', 'presentation', ['repositoryTimeline']),
  param('window', 'int', 'presentation', ['matrix']),
  param('q', 'text', 'presentation', [
    'records',
    'insight',
    'authorRecords',
    'repositoryTimeline',
    'contributionOverview',
    'contributionDetail',
    'export',
  ]),
  param('sort', 'sort', 'presentation', tables),
  param(
    'page',
    'int',
    'presentation',
    tables.filter((screen) => screen !== 'export'),
  ),
  param('cols', 'cols', 'presentation', [
    'records',
    'insight',
    'authorRecords',
    'repositoryTimeline',
    'contributionOverview',
    'contributionDetail',
    'contributionTimeline',
  ]),
  param('charts', 'flag', 'presentation', ['records', 'authorRecords']),
  param('zero', 'enum', 'presentation', ['contributionDetail', 'export'], { values: ['hide'] }),
  // A Reviewers-lens overview listing every account with activity, not only reviewers (P6c). The
  // report rejects it outside that lens and on a metric's records.
  param('all', 'flag', 'presentation', ['contributionOverview', 'export'], {
    exceptRoutes: ['/contributors'],
  }),
  param('bsort', 'sort', 'presentation', ['summary']),
  param('bpage', 'int', 'presentation', ['summary']),
  param('asort', 'sort', 'presentation', ['summary']),
  param('apage', 'int', 'presentation', ['summary']),
  // The parent author list an author's records came from.
  param('listq', 'text', 'presentation', ['authorRecords', 'support']),
  param('listsort', 'sort', 'presentation', ['authorRecords', 'support']),
  param('listpage', 'int', 'presentation', ['authorRecords', 'support']),
  // Supporting views: one Timeline cell's records, with their own table.
  param('detail', 'text', 'support', ['support']),
  param('interval', 'interval', 'support', ['support']),
  param('snap', 'snap', 'support', ['support']),
  param('origin', 'enum', 'support', ['support'], { values: ['timeline', 'matrix'] }),
  param('author', 'text', 'support', ['support']),
  param('dq', 'text', 'support', ['support']),
  param('dsort', 'sort', 'support', ['support']),
  param('dpage', 'int', 'support', ['support']),
  param('dcols', 'cols', 'support', ['support']),
  // Export choices.
  param('entity', 'enum', 'support', ['export'], {
    values: ['overview', 'contributor', 'company'],
  }),
  param('id', 'text', 'support', ['export']),
  param('layout', 'enum', 'support', ['export'], { values: ['summary', 'repositories'] }),
  param('columns', 'list', 'support', ['export']),
  // Return context: the parent frames (P5d).
  param(
    'back',
    'frames',
    'return',
    reportScreens.filter((screen) => screen !== 'summary'),
  ),
  param('v', 'version', 'version', reportScreens),
];

/** The parameter a screen of a route accepts under a name, or undefined. */
export function paramFor(route: UrlRoute, screen: UrlScreen, name: string): UrlParam | undefined {
  const accepts = (candidate: UrlScreen) =>
    urlParams.find(
      (entry) =>
        entry.name === name &&
        entry.screens.includes(candidate) &&
        !entry.exceptRoutes?.includes(route),
    );
  return accepts(screen) ?? (screen === 'support' ? accepts(timelineScreen(route)) : undefined);
}
/** Every parameter a screen accepts, in serialization order. */
export function screenParams(route: UrlRoute, screen: UrlScreen): UrlParam[] {
  const names = [...new Set(urlParams.map((entry) => entry.name))];
  return names
    .map((name) => paramFor(route, screen, name))
    .filter((entry): entry is UrlParam => entry !== undefined)
    .sort((a, b) => urlDomains.indexOf(a.domain) - urlDomains.indexOf(b.domain));
}
/** Every registry name, across routes and screens. */
export const urlParamNames: ReadonlySet<string> = new Set(urlParams.map((entry) => entry.name));

/** Period presets a `period` value may name. */
export const urlPeriodPresets: readonly string[] = periodPresets;

/** A route path from decoded segments. */
export function routePath(route: UrlRoute, segments: UrlSegments = {}): string {
  return route
    .split('/')
    .flatMap((part) => {
      const name = /^\[(?:\.\.\.)?([^\]]+)\]$/.exec(part)?.[1];
      return name ? (segments[name] ?? []).map(encodeURIComponent) : [part];
    })
    .join('/');
}
const staticRoutes: Readonly<Record<string, UrlRoute>> = {
  '/repos': '/repos',
  '/contributors': '/contributors',
  '/companies': '/companies',
  '/reviewers': '/reviewers',
  '/contributors/export': '/contributors/export',
  '/companies/export': '/companies/export',
};
/**
 * The route allowlist: a report path and its decoded segments, or null for anything else (other
 * pages, external or protocol-relative paths, malformed escapes, empty segments).
 */
export function matchRoute(pathname: string): { route: UrlRoute; segments: UrlSegments } | null {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return null;
  if (staticRoutes[pathname]) return { route: staticRoutes[pathname], segments: {} };
  const parts = pathname.slice(1).split('/');
  const decoded: string[] = [];
  for (const part of parts) {
    try {
      const value = decodeURIComponent(part);
      if (!value || value.includes('/')) return null;
      decoded.push(value);
    } catch {
      return null;
    }
  }
  const [area, ...rest] = decoded;
  if (area === 'repos' && rest.length === 1)
    return { route: '/repos/[slug]', segments: { slug: rest } };
  if (area === 'repos' && rest.length === 3 && rest[1] === 'authors')
    return {
      route: '/repos/[slug]/authors/[account]',
      segments: { slug: [rest[0]], account: [rest[2]] },
    };
  if (area === 'contributors' && rest.length === 1)
    return { route: '/contributors/[accountId]', segments: { accountId: rest } };
  if (
    area === 'companies' &&
    ((rest.length === 1 && rest[0] === 'unmapped') || (rest.length === 2 && rest[0] === 'id'))
  )
    return { route: '/companies/[...identity]', segments: { identity: rest } };
  return null;
}
