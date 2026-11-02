import 'server-only';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { repositoryCatalog } from '@/config/repositories';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import type { ContributionLens } from '@/models/contribution-lens';
import type {
  TimelineArea,
  TimelineControlContext,
  TimelinePreferences,
} from '@/models/timeline-controls';
import type { ContributionDirectory, ContributionSettings } from '@/models/contribution-settings';
import type { SavedPreference } from '@/models/preferences';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import {
  repositoryTimelineSample,
  repositoryTimelineMatrixSample,
} from '@/mocks/repository-timeline';
import { repositoryPageNavigationSample } from '@/mocks/repository-page';
import { contributionSampleAsOf } from '@/mocks/contributions';
import { selectContributionTimeline } from '@/lib/presentation/contribution-timeline';
import { selectRepositoryTimeline } from '@/lib/presentation/repository-timeline';
import {
  readContributionSettings,
  contributionScopeKeys,
  hasContributionScope,
} from '@/lib/presentation/contribution-settings';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import { companyFocus, contributionPath } from '@/lib/presentation/contribution-navigation';
import {
  backFrames,
  resolveBack,
  viewHref,
  type Ancestor,
  type UrlView,
} from '@/lib/presentation/url/back';
import { urlHref, withoutDefaults } from '@/lib/presentation/url/codec';
import { screenOf, type UrlValue, type UrlValues } from '@/lib/presentation/url/registry';
import { timelineParams } from '@/lib/presentation/url/timeline';
import { timelineStateValues } from '@/lib/presentation/url/legacy/decode';
import type { SavedViewValues } from '@/lib/presentation/url/entry';
import {
  selectRepositoryTimelineMatrix,
  matrixRepositoryIds,
} from '@/lib/presentation/repository-timeline-matrix';
import {
  readTimelineSource,
  readTimelineView,
  resolveTimelineEntry,
  timelinePreferenceSection,
  timelineViewKeys,
  validateTimelineScope,
} from '@/lib/presentation/timeline-controls';
import {
  rejectedPreference,
  savedContributionScope,
  savedTimelinePresentation,
  type PreferenceSnapshot,
} from './preferences';
import { repositoryFilterOptions } from '@/lib/presentation/repository-page-filters';
import {
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
} from '@/models/repository-timeline';
import type { RepositoryPagePr, RepositoryPageIssue } from '@/models/repository-page';

const invalid = (message = 'The requested timeline view, date range or filters are invalid.') => ({
  status: 'invalid' as const,
  message,
});
const repositories = repositoryCatalog
  .filter((row) => row.enabled)
  .map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.displayName,
    primaryBranch: row.primaryBranch === 'main' ? ('main' as const) : ('master' as const),
  }));
function options(params: URLSearchParams, area: TimelineArea, path: string) {
  if (['scope', 'population', 'view'].some((key) => params.getAll(key).length > 1))
    return invalid();
  const allowed = new Set<string>([
    'timeline',
    ...timelineViewKeys,
    'timeline.gap',
    'timeline.omitted',
    'sample',
    'period',
    'from',
    'through',
    ...(area === 'matrix'
      ? ['repo']
      : area === 'repository'
        ? []
        : [...contributionScopeKeys, 'view', 'members.zero', 'lens']),
  ]);
  if (
    !contributionUrlFits(path + '?' + params.toString()) ||
    [...params.keys()].some(
      (key) =>
        !allowed.has(key) &&
        !(area === 'repository' && /^(prs|issues)\.(q|filter\.[a-zA-Z]+)$/.test(key)) &&
        !(
          area === 'contribution' &&
          /^(report|contributors|companies|members|repositories|details)\.(q|sort|dir|page|columns)$/.test(
            key,
          )
        ),
    )
  )
    return invalid();
  const source = readTimelineSource(params, area);
  if (
    !source ||
    params.has('metric') ||
    (params.has('lens') &&
      (params.getAll('lens').length > 1 || params.get('lens') !== 'reviewers')) ||
    (params.has('timeline.omitted') && params.get('timeline.omitted') !== 'current')
  )
    return invalid();
  try {
    return {
      status: 'valid' as const,
      search: params.toString(),
      ...readTimelineView(params, area, contributionSampleAsOf),
      ...source,
    };
  } catch (error) {
    return invalid(
      error instanceof z.ZodError
        ? 'The requested timeline options are invalid.'
        : error instanceof Error
          ? error.message
          : undefined,
    );
  }
}
function context(
  area: TimelineArea,
  path: string,
  parsed: Extract<ReturnType<typeof options>, { status: 'valid' }>,
  preferenceScope: string,
): TimelineControlContext {
  return {
    area,
    path,
    href: path + '?' + parsed.search,
    sample: parsed.sample + (parsed.gap ? ':gap' : ''),
    asOf: contributionSampleAsOf,
    preferenceScope,
    period: parsed.period,
    exactRange: parsed.exactRange,
    view: parsed.view,
    metricIds: parsed.metricIds,
    repositories,
  };
}
/** How a Timeline loader treats an entry and the viewer's saved values. */
export interface TimelinePreviewOptions {
  /**
   * Answer an entry whose saved view differs with `{ status: 'redirect' }` (the default). The page
   * helper has already redirected such an entry, so a page render passes false and an entry whose
   * saved values add nothing renders as it is.
   */
  redirect?: boolean;
  /** Whether the shared contribution scope applies on an entry: list routes only (decision C2). */
  savedScope?: boolean;
}
/**
 * The saved-preference sections for one Timeline render. An entry, a query without timeline.state,
 * resolves against them to a redirect to its explicit-state query, or to the requested view with a
 * notice; an explicit-state query never reads saved values. Without a snapshot nothing is saved.
 */
function timelinePreferences(
  params: URLSearchParams,
  controls: TimelineControlContext,
  snapshot: PreferenceSnapshot | undefined,
  directory: ContributionDirectory | undefined,
  options: TimelinePreviewOptions,
): { redirect: string } | { preferences?: TimelinePreferences } {
  if (!snapshot) return {};
  const section = timelinePreferenceSection(controls.area, controls.preferenceScope);
  const unread = { binding: snapshot.binding, value: null };
  const entry = !params.has('timeline.state');
  const presentation: SavedPreference<string> = entry
    ? savedTimelinePresentation(snapshot, section, controls.area)
    : { section, ...unread };
  const consultScope = entry && options.savedScope !== false && !hasContributionScope(params);
  const scope: SavedPreference<ContributionSettings> | undefined =
    directory &&
    (consultScope
      ? savedContributionScope(snapshot, directory, controls.asOf)
      : { section: 'contributions.scope', ...unread });
  if (!entry) return { preferences: { presentation, scope } };
  const resolved = resolveTimelineEntry(params.toString(), controls, {
    presentation: presentation.invalid === undefined ? (presentation.value ?? '') : null,
    scope:
      !scope || !consultScope
        ? undefined
        : scope.invalid === undefined
          ? (scope.value ?? undefined)
          : null,
  });
  if (resolved.kind === 'redirect')
    return options.redirect === false
      ? { preferences: { presentation, scope } }
      : { redirect: controls.path + '?' + resolved.search };
  // Only the section a notice reports is deleted after hydration; the other was not consulted. A
  // well-formed presentation that fails on every visit is reported as well as an unreadable one.
  const reported = <T>(saved: SavedPreference<T>, kind: 'presentation' | 'scope') =>
    resolved.rejected === kind
      ? rejectedPreference(snapshot, saved)
      : { section: saved.section, binding: saved.binding, value: saved.value };
  return {
    preferences: {
      presentation: reported(presentation, 'presentation'),
      scope: scope && reported(scope, 'scope'),
      notice: resolved.notice,
    },
  };
}
const redirectTo = (href: string) => ({ status: 'redirect' as const, href });
export async function contributionTimelinePreview(
  area: ContributionArea,
  params: URLSearchParams,
  focus: ContributionFocus = { kind: 'overview' },
  preferences?: PreferenceSnapshot,
  previewOptions: TimelinePreviewOptions = {},
) {
  const viewer = await requireViewer();
  // The Timeline query names the Reviewers lens, which keeps its own Over time presentation.
  const lens: ContributionLens = params.get('lens') === 'reviewers' ? 'reviewers' : 'contributors';
  const path = contributionPath(focus.kind === 'overview' ? area : focus, lens),
    parsed = options(params, 'contribution', path);
  if (parsed.status === 'invalid') return parsed;
  if (parsed.sample === 'mixed') return invalid();
  const sample = contributionTimelineSample(parsed.sample, parsed.gap);
  const settings = readContributionSettings(
    params,
    sample.contributions,
    sample.contributions.asOf,
  );
  if (
    !settings ||
    (params.has('view') && !['members', 'repositories'].includes(params.get('view')!))
  )
    return invalid();
  if (
    (focus.kind === 'contributor' &&
      !sample.contributions.accounts.some((row) => row.id === focus.accountId)) ||
    (focus.kind === 'company' &&
      focus.companyId !== null &&
      !sample.contributions.companies.some((row) => row.id === focus.companyId))
  )
    notFound();
  const controls: TimelineControlContext = {
    ...context(
      'contribution',
      path,
      parsed,
      (lens === 'reviewers' ? 'reviewers.' : '') + area + ':' + focus.kind,
    ),
    contribution: settings,
    lens,
  };
  const saved = timelinePreferences(
    params,
    controls,
    preferences,
    sample.contributions,
    previewOptions,
  );
  if ('redirect' in saved) return redirectTo(saved.redirect);
  return {
    status: 'ready' as const,
    viewerId: viewer.id,
    report: selectContributionTimeline(sample, parsed.request, settings.selection, focus),
    href: path + '?' + params.toString(),
    controls: { ...controls, ...saved },
  };
}
export async function repositoryTimelinePreview(
  slug: string,
  params: URLSearchParams,
  preferences?: PreferenceSnapshot,
  previewOptions: TimelinePreviewOptions = {},
) {
  const viewer = await requireViewer();
  const repository = repositoryCatalog.find((row) => row.slug === slug && row.enabled);
  if (!repository) notFound();
  const path = '/repos/' + encodeURIComponent(slug),
    parsed = options(params, 'repository', path);
  if (parsed.status === 'invalid') return parsed;
  let filters;
  try {
    filters = validateTimelineScope(params, parsed, 'repository', repositories)!;
  } catch (error) {
    return invalid(error instanceof Error ? error.message : undefined);
  }
  const controls: TimelineControlContext = {
    ...context('repository', path, parsed, repository.id),
    filters,
  };
  const saved = timelinePreferences(params, controls, preferences, undefined, previewOptions);
  if ('redirect' in saved) return redirectTo(saved.redirect);
  const source = repositoryTimelineSample(
    parsed.view.kind,
    repository.id,
    parsed.sample,
    parsed.gap,
  );
  const rows = [
    ...source.rows,
    ...source.snapshots.flatMap<RepositoryPagePr | RepositoryPageIssue>(
      (snapshot) => snapshot.rows,
    ),
  ];
  return {
    status: 'ready' as const,
    viewerId: viewer.id,
    report: selectRepositoryTimeline(source, parsed.request, parsed.view.family, filters),
    navigation: repositoryPageNavigationSample(source.repository),
    href: path + '?' + params.toString(),
    omitted: params.get('timeline.omitted') === 'current',
    facets: repositoryFilterOptions(rows),
    controls: { ...controls, ...saved },
  };
}
export async function repositoryTimelineMatrixPreview(
  params: URLSearchParams,
  preferences?: PreferenceSnapshot,
  previewOptions: TimelinePreviewOptions = {},
) {
  const viewer = await requireViewer(),
    parsed = options(params, 'matrix', '/repos');
  if (parsed.status === 'invalid') return parsed;
  try {
    validateTimelineScope(params, parsed, 'matrix', repositories);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : undefined);
  }
  const repositoryIds = matrixRepositoryIds(
    params,
    repositories.map((row) => row.id),
  );
  const controls: TimelineControlContext = {
    ...context('matrix', '/repos', parsed, 'matrix'),
    repositoryIds,
  };
  const saved = timelinePreferences(params, controls, preferences, undefined, previewOptions);
  if ('redirect' in saved) return redirectTo(saved.redirect);
  const kinds = new Set(
    parsed.metricIds.map(
      (metric) => repositoryTimelineMetricScope(metric as RepositoryTimelineMetric).recordKind,
    ),
  );
  const source = repositoryTimelineMatrixSample(
    kinds.size > 1 ? 'mixed' : kinds.has('issues') ? 'issues' : 'prs',
    parsed.sample,
    parsed.gap,
  );
  // validateTimelineScope applied the matrix size rule above to these same inputs.
  return {
    status: 'ready' as const,
    viewerId: viewer.id,
    matrix: selectRepositoryTimelineMatrix(source, parsed.request, {
      repositoryIds,
      metrics: parsed.metricIds as RepositoryTimelineMetric[],
    }),
    href: '/repos?' + params.toString(),
    controls: { ...controls, ...saved },
  };
}

/**
 * A page render's loader result that is not ready: its invalid view. A page render never redirects
 * (the page helper answered the entry), so a redirect result cannot occur here.
 */
function notRendered(
  result: { status: 'invalid'; message: string } | { status: 'redirect'; href: string },
) {
  return 'message' in result ? result : invalid();
}
/** The matrix's Summary tab: its parent, else the Summary it derives (a tab is never unavailable). */
function summaryTab(view: UrlView, parent: Ancestor | undefined): string | null {
  // Without a frame the parent is the Summary at the matrix's repositories; at v1 defaults that is
  // the bare area entry, which the screen links in the viewer's saved form, as the masthead does.
  if (!view.values.back && view.values.repo === undefined) return null;
  return parent?.available
    ? parent.href
    : urlHref('/repos', {}, view.values.repo ? { repo: view.values.repo } : {}, { explicit: true });
}
const crumb = (ancestor: Ancestor | undefined) =>
  ancestor === undefined ? undefined : ancestor.available ? ancestor.href : null;
/**
 * A Timeline page from its registry values: the page helper has answered legacy links and entry
 * redirects, so an entry renders here with its notice, if any, and never redirects. Hrefs and
 * crumbs are canonical; the Timeline's own controls keep their query form (decision C9).
 */
export async function timelineView(
  view: UrlView,
  options: { entry?: boolean; preferences?: PreferenceSnapshot } = {},
) {
  const { route, segments, values } = view;
  const params = timelineParams(route, values, contributionSampleAsOf, { entry: options.entry });
  const href = viewHref(view, 'level');
  if (!params || href === null) return invalid();
  const ancestors = resolveBack(view);
  const canonical = <T extends { controls: TimelineControlContext }>(result: T) => ({
    ...result,
    href,
    controls: { ...result.controls, href },
  });
  const screen = screenOf(route, values);
  if (screen === 'matrix') {
    const result = await repositoryTimelineMatrixPreview(params, options.preferences, {
      redirect: false,
    });
    if (result.status !== 'ready') return notRendered(result);
    return { ...canonical(result), summaryHref: summaryTab(view, ancestors[0]) };
  }
  if (route === '/repos/[slug]') {
    const result = await repositoryTimelinePreview(segments.slug[0], params, options.preferences, {
      redirect: false,
    });
    if (result.status !== 'ready') return notRendered(result);
    return { ...canonical(result), parent: crumb(ancestors[0]) };
  }
  const area = route.startsWith('/companies') ? 'companies' : 'contributors';
  const focus: ContributionFocus =
    route === '/contributors/[accountId]'
      ? { kind: 'contributor', accountId: segments.accountId[0] }
      : route === '/companies/[...identity]'
        ? (companyFocus([...segments.identity]) ?? { kind: 'overview' })
        : { kind: 'overview' };
  const result = await contributionTimelinePreview(area, params, focus, options.preferences, {
    redirect: false,
    savedScope: focus.kind === 'overview',
  });
  if (result.status !== 'ready') return notRendered(result);
  const [report, returnTo] = ancestors;
  return {
    ...canonical(result),
    reportHref: reportTab(view, report),
    returnTo: focus.kind === 'overview' ? undefined : crumb(returnTo),
  };
}
const reportScope = ['sample', 'lens', 'period', 'repo', 'type', 'account', 'company', 'exclude'];
const pick = (values: UrlValues, keep: (name: string) => boolean): Record<string, UrlValue> =>
  Object.fromEntries(Object.entries(values).filter(([name]) => keep(name)));
/**
 * The Over time Report tab: the report at the Over time's current scope, with the presentation of
 * the report it came from (its search, sort, columns and breakdown), and that report's own
 * parents. A tab is never unavailable: without a restorable report it opens the derived one. The
 * report's page restarts when the scope changed.
 */
function reportTab(view: UrlView, report: Ancestor | undefined): string {
  const { route, segments, values } = view;
  const scope = pick(values, (name) => reportScope.includes(name));
  const presentation = report?.available
    ? pick(report.view.values, (name) => !reportScope.includes(name) && name !== 'v')
    : {};
  if (
    report?.available &&
    urlHref(
      route,
      segments,
      pick(report.view.values, (name) => reportScope.includes(name)),
    ) !== urlHref(route, segments, scope)
  )
    delete presentation.page;
  const frames = backFrames(values).slice(1);
  const href = viewHref(
    { route, segments, values: { ...scope, ...presentation, back: frames } },
    'back',
    { explicit: true },
  );
  return href ?? urlHref(route, segments, scope, { explicit: true });
}
/**
 * The saved view a Timeline entry opens at (decisions C1, C2 and C9), for the page helper: the
 * saved presentation, and on list routes the saved scope, merged and validated as the Timeline
 * loaders resolve an entry. Null when nothing applies or a saved section is reported with a notice;
 * the page then renders the entry, and its loader shows the notice.
 */
export async function timelineEntryValues(
  view: UrlView,
  preferences: PreferenceSnapshot,
): Promise<SavedViewValues | null> {
  const { route, segments, values } = view;
  const params = timelineParams(route, values, contributionSampleAsOf, { entry: true });
  if (!params) return null;
  const screen = screenOf(route, values);
  let result;
  if (screen === 'matrix') result = await repositoryTimelineMatrixPreview(params, preferences);
  else if (route === '/repos/[slug]')
    result = await repositoryTimelinePreview(segments.slug[0], params, preferences);
  else {
    const list = route === '/contributors' || route === '/reviewers' || route === '/companies';
    const focus: ContributionFocus =
      route === '/contributors/[accountId]'
        ? { kind: 'contributor', accountId: segments.accountId[0] }
        : route === '/companies/[...identity]'
          ? (companyFocus([...segments.identity]) ?? { kind: 'overview' })
          : { kind: 'overview' };
    result = await contributionTimelinePreview(
      route.startsWith('/companies') ? 'companies' : 'contributors',
      params,
      focus,
      preferences,
      { savedScope: list },
    );
  }
  if (result.status !== 'redirect') return null;
  const query = result.href.slice(result.href.indexOf('?') + 1);
  const saved = timelineStateValues(
    route,
    query,
    contributionSampleAsOf,
    screen === 'contributionTimeline' ? { repositories } : undefined,
  );
  if (!saved) return null;
  // Only what differs from the v1 defaults is saved; the entry's own selectors stay its own.
  const presentation = pick(withoutDefaults(route, saved), (name) => !(name in values));
  return Object.keys(presentation).length ? { scope: {}, presentation } : null;
}
