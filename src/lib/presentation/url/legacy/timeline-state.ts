// The Timeline screens' view state (decision C9): a query of `timeline.*`, `period`, `repo`, record
// filter and contribution scope keys. The frozen readers validate it, the preference cookie stores
// it, and the Timeline controls compute their next view in it; addresses and links never carry it.
// `url/timeline.ts` writes registry values in this form and `timelineStateValues` reads them back.
import { readTimelineSource, readTimelineView } from './timeline';
export { readTimelineSource, readTimelineView };
import {
  timelineViewKeys,
  type TimelineArea,
  type TimelineControlContext,
  type TimelineViewState,
} from '@/models/timeline-controls';
import { type PeriodSelection } from '@/models/reporting-period';
import type { RepositoryPageFilters } from '@/models/repository-page';
import {
  hasContributionScope,
  readContributionScopeInput,
  writeContributionSettings,
} from './contribution';
import { defaultContributionSettings } from '../../contribution-settings-rules';
import type { ContributionSettings } from '@/models/contribution-settings';
import { preferenceSectionKeys, type PreferenceSectionKey } from '@/models/preferences';

import { z } from 'zod';
import { contributionUrlFits } from '../../contribution-return';
import { canonicalRoutePath } from '../../navigation';
import { readRepositoryFilterValues, writeRepositoryFilters } from './repository';
import { validateRepositoryTimelineFilters } from '../../repository-timeline';
import { isEntry, parseQuery, withoutDefaults } from '../codec';
import { matchRoute } from '../registry';
import { timelineQuery } from '../timeline';
import { defaultValue } from '../defaults';
import { periodSelection } from '../period';
import { timelineScreen, type UrlRoute, type UrlValue, type UrlValues } from '../registry';
import { timelineStateValues } from './decode';
import { repositoryCatalog } from '@/config/repositories';

import { assertMatrixCellLimit, matrixRepositoryIds } from '../../repository-timeline-matrix';
export { timelineViewKeys };
export function writeTimelineView(
  search: string,
  area: TimelineArea,
  view: TimelineViewState,
): string {
  const params = new URLSearchParams(search);
  for (const key of timelineViewKeys)
    if (!['timeline.from', 'timeline.to', 'timeline.inclusive'].includes(key)) params.delete(key);
  params.set('timeline', '1');
  params.set('timeline.state', '1');
  params.set('timeline.group', view.grouping);
  if (area === 'repository') {
    params.set('timeline.kind', view.kind);
    params.set('timeline.family', view.family);
  }
  if (area === 'matrix') {
    const selectedMetrics = view.selectedMetrics ?? [view.metric];
    if (!selectedMetrics.length) params.set('timeline.metric', '');
    else {
      for (const id of selectedMetrics) params.append('timeline.metric', id);
      params.set('timeline.rank', view.metric);
    }
  } else if (area === 'repository') params.set('timeline.metric', view.metric);
  if (area === 'repository') params.set('timeline.chart', view.chart ? '1' : '0');
  params.set('timeline.sort', view.sort);
  params.set('timeline.dir', view.descending ? 'desc' : 'asc');
  params.set('timeline.page', String(view.page));
  if (area === 'matrix') params.set('timeline.window', String(view.window));
  else if (view.columns) {
    if (!view.columns.length) params.set('timeline.columns', '');
    else for (const id of view.columns) params.append('timeline.columns', id);
  }
  return params.toString();
}
export function writeTimelinePeriod(search: string, period: PeriodSelection) {
  const params = new URLSearchParams(search);
  for (const key of [
    'period',
    'from',
    'through',
    'timeline.from',
    'timeline.to',
    'timeline.inclusive',
  ])
    params.delete(key);
  params.set('period', period.kind === 'preset' ? period.preset : 'custom');
  if (period.kind === 'custom') {
    params.set('from', period.from);
    params.set('through', period.through);
  }
  return params.toString();
}
export function timelinePreferenceKey(
  viewer: string,
  context: Pick<TimelineControlContext, 'sample' | 'preferenceScope'>,
) {
  return (
    'dashboard:timeline:v1:' +
    encodeURIComponent(viewer) +
    ':' +
    encodeURIComponent(context.sample) +
    ':' +
    context.preferenceScope
  );
}
/** Only deliberate preference fields are stored; links, exact intervals and row/window pages are never defaults. */
export function timelinePreferenceFields(area: TimelineArea) {
  return [
    'timeline.group',
    'timeline.kind',
    'timeline.family',
    'timeline.metric',
    'timeline.rank',
    'timeline.chart',
    'timeline.sort',
    'timeline.dir',
    'timeline.columns',
    ...(area === 'contribution' ? [] : ['period', 'from', 'through', 'repo', 'prs.q', 'issues.q']),
  ];
}
export function timelinePreferenceParameters(params: URLSearchParams, area: TimelineArea) {
  const result = new URLSearchParams();
  for (const [key, value] of params)
    if (
      timelinePreferenceFields(area).includes(key) ||
      (area === 'repository' && /^(prs|issues)\.filter\./.test(key))
    )
      result.append(key, value);
  return result;
}
/** Scope rules shared by client proposals and server loaders; errors carry user-facing text. */
export function validateTimelineScope(
  params: URLSearchParams,
  parsed: ReturnType<typeof readTimelineView>,
  area: TimelineArea,
  repositories: readonly { id: string }[],
): RepositoryPageFilters | undefined {
  let filters: RepositoryPageFilters | undefined;
  if (area === 'repository') {
    const opposite = parsed.view.kind === 'prs' ? 'issues' : 'prs';
    if ([...params.keys()].some((key) => key.startsWith(opposite + '.')))
      throw Error('Record filters must match the selected kind.');
    filters = readRepositoryFilterValues(params.toString(), parsed.view.kind) ?? undefined;
    if (!filters) throw Error('Choose valid repository filters.');
    validateRepositoryTimelineFilters(filters, parsed.view.family);
  }
  const selected = params.getAll('repo').filter(Boolean);
  if (selected.some((id) => !repositories.some((row) => row.id === id)))
    throw Error('A selected repository is no longer available.');
  if (area === 'matrix')
    assertMatrixCellLimit(
      matrixRepositoryIds(
        params,
        repositories.map((row) => row.id),
      ).length,
      parsed.metricIds.length,
      parsed.intervals.length,
    );
  return filters;
}
export function validateTimelineProposal(search: string, context: TimelineControlContext) {
  if (!contributionUrlFits(context.path + '?' + search))
    throw Error('This view is too large for a link. Reduce the selection.');
  const params = new URLSearchParams(search),
    parsed = readTimelineView(params, context.area, context.asOf);
  validateTimelineScope(params, parsed, context.area, context.repositories);
  return parsed;
}
const timelinePreferenceVersion = 1;
export function serializeTimelinePreferences(params: URLSearchParams, area: TimelineArea) {
  return JSON.stringify({
    version: timelinePreferenceVersion,
    query: timelinePreferenceParameters(params, area).toString(),
  });
}
export function readTimelinePreferences(
  raw: string | null,
  area: TimelineArea,
): URLSearchParams | null {
  if (raw === null) return new URLSearchParams();
  try {
    const stored = z
      .object({ version: z.literal(timelinePreferenceVersion), query: z.string().max(7500) })
      .strict()
      .parse(JSON.parse(raw));
    const params = new URLSearchParams(stored.query);
    return timelinePreferenceParameters(params, area).toString() === params.toString()
      ? params
      : null;
  } catch {
    return null;
  }
}
// Saved presentation choices that depend on the record kind, family, grouping or period.
const dependentPreferenceGroups = [
  ['timeline.sort', 'timeline.dir'],
  ['timeline.metric', 'timeline.rank'],
  ['timeline.columns'],
];
/**
 * Merged restoration first, then the same merge without each saved dependent group that no longer
 * fits, so one stale choice does not discard every other saved preference. A saved grouping, saved
 * record filters and a saved matrix repository selection are dropped only after every presentation
 * fallback has failed: a report scope outranks a grouping or filter that cannot cover it.
 */
export function timelinePreferenceCandidates(
  merged: URLSearchParams,
  explicit: URLSearchParams,
): URLSearchParams[] {
  const without = (groups: string[][]) => {
    const result = new URLSearchParams(merged);
    for (const key of groups.flat()) if (!explicit.has(key)) result.delete(key);
    return result;
  };
  const isSaved = (group: string[]) => group.some((key) => merged.has(key) && !explicit.has(key));
  const saved = dependentPreferenceGroups.filter(isSaved);
  const filters = [...new Set(merged.keys())].filter((key) => /^(prs|issues)\./.test(key));
  const scope = [['timeline.group'], filters, ['repo']].filter(isSaved);
  const candidates = [
    merged,
    ...saved.map((group) => without([group])),
    ...(saved.length > 1 ? [without(saved)] : []),
    ...scope.flatMap((group) => [
      without([group]),
      ...(saved.length ? [without([...saved, group])] : []),
    ]),
    ...(scope.length > 1 ? [without([...saved, ...scope])] : []),
  ];
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => other.toString() === candidate.toString()) === index,
  );
}
/** Explicit domains win independently: a repository choice need not discard a saved date preset. */
export function mergeTimelinePreferenceParameters(
  explicit: URLSearchParams,
  stored: URLSearchParams,
) {
  const result = new URLSearchParams(explicit);
  const period = ['period', 'from', 'through'].some((key) => explicit.has(key));
  const filters =
    period ||
    explicit.has('timeline.kind') ||
    explicit.has('timeline.family') ||
    [...explicit.keys()].some((key) => /^(prs|issues)\./.test(key));
  const differentFamily = ['timeline.kind', 'timeline.family'].some(
    (key) => explicit.has(key) && stored.has(key) && explicit.get(key) !== stored.get(key),
  );
  // Records saved before filters carried their kind can hold the other kind's filters.
  const kind = explicit.get('timeline.kind') ?? stored.get('timeline.kind') ?? 'prs';
  for (const name of new Set(stored.keys())) {
    if (
      explicit.has(name) ||
      (name === 'timeline.rank' &&
        explicit.has('timeline.metric') &&
        !explicit.getAll('timeline.metric').includes(stored.get(name) ?? '')) ||
      (period && ['period', 'from', 'through'].includes(name)) ||
      (/^(prs|issues)\./.test(name) && (filters || !name.startsWith(kind + '.'))) ||
      (differentFamily &&
        ['timeline.metric', 'timeline.columns', 'timeline.sort', 'timeline.dir'].includes(name))
    )
      continue;
    for (const value of stored.getAll(name)) result.append(name, value);
  }
  return result;
}
/** The cookie section that keeps a Timeline's presentation: one per area and view kind. */
export function timelinePreferenceSection(
  area: TimelineArea,
  preferenceScope: string,
): PreferenceSectionKey {
  if (area !== 'contribution') return area === 'matrix' ? 'timeline.matrix' : 'timeline.repository';
  const section = 'timeline.' + preferenceScope.replace(':', '.');
  const known: readonly string[] = preferenceSectionKeys.contributions;
  if (!known.includes(section)) throw Error('Unknown contribution Timeline view.');
  return section as PreferenceSectionKey;
}
/** The explicit-state URL query for a proposal; throws a user-facing error when it does not fit. */
export function timelineTarget(input: string, context: TimelineControlContext): string {
  const checked = validateTimelineProposal(input, context);
  const target = writeTimelineView(input, context.area, checked.view);
  if (!contributionUrlFits(context.path + '?' + target))
    throw Error('This view is too large for a link. Reduce the selection.');
  return target;
}
export const timelineEntryNotices = {
  invalid: 'Saved Timeline preferences are invalid. Defaults are shown.',
  skipped: 'Saved Timeline choices that do not fit this report were skipped.',
  scopeInvalid: 'Saved filters could not be restored. Default filters are shown.',
  scopeUnfit:
    'Saved filters are too large or incompatible with this Timeline. The requested view is unchanged.',
  unfit: 'Saved Timeline preferences do not fit this report. The requested view is unchanged.',
} as const;
export type TimelineEntry =
  | { kind: 'redirect'; search: string }
  /** Render the requested URL as it is; `rejected` names the invalid section the notice is about. */
  | { kind: 'final'; notice?: string; rejected?: 'presentation' | 'scope' };
/**
 * Whether saved presentation choices fail on a bare entry, where no explicit field can be the
 * cause. Such choices would be skipped on every visit, so their section is treated as invalid.
 */
function failsOnBareEntry(presentation: string, context: TimelineControlContext): boolean {
  const bare = new URLSearchParams('timeline=1');
  try {
    timelineTarget(
      mergeTimelinePreferenceParameters(bare, new URLSearchParams(presentation)).toString(),
      context,
    );
    return false;
  } catch {
    return true;
  }
}
/**
 * Resolve a Timeline entry, a URL without `timeline.state`, against saved preferences on the
 * server. Explicit fields win per domain, a saved scope applies only when the URL names none, and
 * stale dependent choices fall back one group at a time. The result is the explicit-state URL to
 * redirect to; when saved preferences cannot apply, the requested view renders with a notice.
 * A saved choice that fails only against this URL's explicit fields is left out of the redirect
 * and stays saved; one that fails even on a bare entry rejects the presentation section, which
 * renders the requested view with the skipped notice.
 */
export function resolveTimelineEntry(
  search: string,
  context: TimelineControlContext,
  saved: {
    /** Saved presentation fields as a query, or null when the saved section is invalid. */
    presentation: string | null;
    /** The saved scope after server validation; null when invalid, undefined when none applies. */
    scope?: ContributionSettings | null;
  },
): TimelineEntry {
  const explicit = new URLSearchParams(search);
  if (explicit.has('timeline.state')) return { kind: 'final' };
  if (saved.presentation === null)
    return { kind: 'final', notice: timelineEntryNotices.invalid, rejected: 'presentation' };
  let params = mergeTimelinePreferenceParameters(explicit, new URLSearchParams(saved.presentation));
  if (
    context.area === 'contribution' &&
    saved.scope !== undefined &&
    !hasContributionScope(explicit)
  ) {
    if (saved.scope === null)
      return { kind: 'final', notice: timelineEntryNotices.scopeInvalid, rejected: 'scope' };
    try {
      validateTimelineProposal(writeContributionSettings(search, saved.scope), context);
    } catch {
      return { kind: 'final', notice: timelineEntryNotices.scopeUnfit };
    }
    params = new URLSearchParams(writeContributionSettings(params.toString(), saved.scope));
  }
  if (!params.has('period'))
    params = new URLSearchParams(writeTimelinePeriod(params.toString(), context.period));
  for (const [index, candidate] of timelinePreferenceCandidates(params, explicit).entries()) {
    let target;
    try {
      target = timelineTarget(candidate.toString(), context);
    } catch {
      continue;
    }
    if (index > 0 && failsOnBareEntry(saved.presentation, context))
      return { kind: 'final', notice: timelineEntryNotices.skipped, rejected: 'presentation' };
    return target === search ? { kind: 'final' } : { kind: 'redirect', search: target };
  }
  return { kind: 'final', notice: timelineEntryNotices.unfit };
}
/** Facts a URL loads, read through the same decoders as the server; null means not reusable. */
function timelineDataKey(search: string, context: TimelineControlContext): string | null {
  const params = new URLSearchParams(search);
  const source = readTimelineSource(params, context.area);
  let parsed;
  try {
    parsed = readTimelineView(params, context.area, context.asOf);
  } catch {
    return null;
  }
  if (!source) return null;
  // The selection matters as well as its range: a custom period can resolve to a preset's range.
  const base = { ...source, period: parsed.period, request: parsed.request };
  if (context.area === 'repository')
    return JSON.stringify({
      ...base,
      kind: parsed.view.kind,
      family: parsed.view.family,
      filters: readRepositoryFilterValues(params.toString(), parsed.view.kind),
    });
  if (context.area === 'matrix')
    return JSON.stringify({
      ...base,
      repositories: matrixRepositoryIds(
        params,
        context.repositories.map((row) => row.id),
      ),
      metrics: parsed.view.selectedMetrics,
    });
  const scope = readContributionScopeInput(params, context, context.asOf);
  if (!scope) return null;
  const sorted = (values: readonly (string | null)[]) => [...new Set(values)].sort();
  return JSON.stringify({
    ...base,
    repositories: sorted(scope.selection.repositoryIds),
    types: sorted(scope.selection.actorTypes),
    population:
      scope.selection.population.kind === 'all'
        ? 'all'
        : {
            accounts: sorted(scope.selection.population.accountIds),
            companies: sorted(scope.selection.population.companyIds),
          },
    exclude: sorted(scope.selection.excludedAccountIds),
  });
}
/**
 * The Timeline query of a canonical Timeline address (decision C9), or null when the address is
 * not one: a legacy link the server has not answered yet, or another page.
 */
export function timelineAddressQuery(
  path: string,
  search: string,
  context: Pick<TimelineControlContext, 'asOf'>,
): string | null {
  const matched = matchRoute(canonicalRoutePath(path));
  if (!matched) return null;
  const parsed = parseQuery(matched.route, search);
  if (parsed.kind !== 'canonical') return null;
  return timelineQuery(matched.route, parsed.values, context.asOf, {
    entry: isEntry(matched.route, parsed.values),
  });
}
/** The view the address shows, or the rendered one while the address waits for its data. */
export function resolveTimelinePresentation(
  path: string,
  search: string,
  context: TimelineControlContext,
) {
  const source = new URL(context.href, 'https://dashboard.invalid');
  const query = timelineAddressQuery(path, search, context),
    rendered = timelineAddressQuery(source.pathname, source.search, context);
  const key = query === null ? null : timelineDataKey(query, context);
  if (
    canonicalRoutePath(path) === canonicalRoutePath(context.path) &&
    key !== null &&
    rendered !== null &&
    key === timelineDataKey(rendered, context)
  ) {
    try {
      return {
        view: readTimelineView(new URLSearchParams(query!), context.area, context.asOf).view,
        query: query!,
        awaitingData: false,
      };
    } catch {
      /* The server owns invalid-link rendering. Keep the current model coherent during navigation. */
    }
  }
  return { view: context.view, query: rendered ?? '', awaitingData: true };
}

// Proposals: the next Timeline query for one control change, computed from the current one.

/** A Timeline query with every field explicit: its period, scope and the given view. */
export function explicitTimelineQuery(
  input: string,
  context: TimelineControlContext,
  view: TimelineViewState,
): string {
  let result = input;
  if (!new URLSearchParams(result).has('period'))
    result = writeTimelinePeriod(result, context.period);
  if (context.contribution) result = writeContributionSettings(result, context.contribution);
  return writeTimelineView(result, context.area, view);
}
/** Timeline query names of view fields, for the preference cookie. */
const viewFieldNames: Partial<Record<keyof TimelineViewState, string>> = {
  grouping: 'group',
  kind: 'kind',
  family: 'family',
  selectedMetrics: 'metric',
  chart: 'chart',
  sort: 'sort',
  descending: 'dir',
  columns: 'columns',
};
const isFilterKey = (name: string) => /^(prs|issues)\./.test(name);
/** A view change: the next query, the saved fields it changes and whether it needs new data. */
export function timelineViewProposal(
  current: string,
  context: TimelineControlContext,
  view: TimelineViewState,
  patch: Partial<TimelineViewState>,
): { query: string; keys: string[]; scope: boolean } {
  const scope =
    'grouping' in patch ||
    (context.area === 'matrix' && 'selectedMetrics' in patch) ||
    'kind' in patch ||
    'family' in patch;
  // A new matrix rank reorders repository groups, so the current row page no longer applies.
  const resetPage = scope || (context.area === 'matrix' && 'metric' in patch);
  const nextView = { ...view, ...patch, ...(resetPage ? { page: 1 } : {}) };
  if (patch.selectedMetrics && !patch.selectedMetrics.includes(nextView.metric))
    nextView.metric = patch.selectedMetrics[0] ?? 'prsOpened';
  const params = new URLSearchParams(
    writeTimelineView(explicitTimelineQuery(current, context, view), context.area, nextView),
  );
  if ('grouping' in patch) {
    params.delete('timeline.window');
    if (context.area === 'matrix') {
      params.set('timeline.sort', 'repository');
      params.set('timeline.dir', 'asc');
    }
  }
  if ('kind' in patch || 'family' in patch) {
    for (const name of [...params.keys()])
      if (isFilterKey(name) || name === 'timeline.columns') params.delete(name);
    params.delete('timeline.metric');
    params.set('timeline.sort', 'period');
    params.set('timeline.dir', 'asc');
  }
  const names = { ...viewFieldNames, metric: context.area === 'matrix' ? 'rank' : 'metric' };
  const keys = Object.keys(patch).flatMap((field) => {
    const name = names[field as keyof TimelineViewState];
    return name ? ['timeline.' + name] : [];
  });
  if ('kind' in patch || 'family' in patch)
    keys.push(
      'timeline.metric',
      'timeline.columns',
      'timeline.sort',
      'timeline.dir',
      ...[...new URLSearchParams(current).keys()].filter(isFilterKey),
    );
  if ('selectedMetrics' in patch) keys.push('timeline.rank');
  if ('grouping' in patch && context.area === 'matrix') keys.push('timeline.sort', 'timeline.dir');
  return { query: params.toString(), keys, scope };
}
/** A period change; it restarts the table and, on the matrix, its ranking. */
export function timelinePeriodProposal(
  current: string,
  context: TimelineControlContext,
  view: TimelineViewState,
  period: PeriodSelection,
): { query: string; keys: string[] } {
  const params = new URLSearchParams(
    writeTimelinePeriod(explicitTimelineQuery(current, context, view), period),
  );
  params.delete('timeline.window');
  params.set('timeline.page', '1');
  if (context.area === 'matrix') {
    params.set('timeline.sort', 'repository');
    params.set('timeline.dir', 'asc');
  }
  return {
    query: params.toString(),
    keys: [
      'period',
      'from',
      'through',
      ...(context.area === 'matrix' ? ['timeline.sort', 'timeline.dir'] : []),
    ],
  };
}
/** A matrix repository selection change. */
export function timelineRepositoriesProposal(
  current: string,
  context: TimelineControlContext,
  view: TimelineViewState,
  ids: readonly string[],
): string {
  const params = new URLSearchParams(explicitTimelineQuery(current, context, view));
  params.delete('repo');
  if (!ids.length) params.set('repo', '');
  else for (const id of ids) params.append('repo', id);
  params.set('timeline.page', '1');
  return params.toString();
}
/** A repository Timeline record filter change, and the filter fields saved with it. */
export function timelineFiltersProposal(
  current: string,
  context: TimelineControlContext,
  view: TimelineViewState,
  filters: RepositoryPageFilters,
): { query: string; keys: string[] } {
  const params = new URLSearchParams(
    writeRepositoryFilters(explicitTimelineQuery(current, context, view), filters),
  );
  params.set('timeline.page', '1');
  const keys = [...new Set([...new URLSearchParams(current).keys(), ...params.keys()])].filter(
    isFilterKey,
  );
  return { query: params.toString(), keys };
}
/** A contribution scope change; a period change also clears an exact interval. */
export function timelineScopeProposal(
  current: string,
  context: TimelineControlContext,
  view: TimelineViewState,
  settings: ContributionSettings,
  periodChanged: boolean,
): string {
  const params = new URLSearchParams(
    writeContributionSettings(explicitTimelineQuery(current, context, view), settings),
  );
  if (periodChanged)
    for (const name of ['timeline.from', 'timeline.to', 'timeline.inclusive']) params.delete(name);
  params.set('timeline.page', '1');
  params.delete('timeline.window');
  return params.toString();
}
/** Reset view: every presentation field back to its default; data scope and selectors stay. */
export function timelineResetProposal(
  current: string,
  context: TimelineControlContext,
  view: TimelineViewState,
): string {
  const params = new URLSearchParams(explicitTimelineQuery(current, context, view));
  for (const name of [...params.keys()])
    if (
      name.startsWith('timeline.') &&
      ![
        'timeline.from',
        'timeline.to',
        'timeline.inclusive',
        'timeline.gap',
        'timeline.omitted',
      ].includes(name)
    )
      params.delete(name);
  if (context.area === 'repository') {
    params.set('timeline.kind', view.kind);
    params.set('timeline.family', view.family);
  }
  return params.toString();
}
/** Reset filters on a contribution Timeline: the default scope, without an exact interval. */
export function timelineScopeResetProposal(
  current: string,
  context: TimelineControlContext,
  view: TimelineViewState,
): string {
  const params = new URLSearchParams(
    writeContributionSettings(
      explicitTimelineQuery(current, context, view),
      defaultContributionSettings({ repositories: context.repositories }),
    ),
  );
  params.set('timeline.page', '1');
  for (const name of ['timeline.from', 'timeline.to', 'timeline.inclusive']) params.delete(name);
  return params.toString();
}
/**
 * The presentation section after a deliberate change: the changed fields of `target` replace the
 * saved ones. Kind-specific choices are saved with their kind and family, and replace another
 * kind's.
 */
export function rememberedTimelinePreferences(
  prior: string | null,
  target: string,
  keys: readonly string[],
  area: TimelineArea,
): unknown {
  const params = new URLSearchParams(target);
  const saved = readTimelinePreferences(prior, area) ?? new URLSearchParams();
  const dependent = (name: string) =>
    isFilterKey(name) ||
    ['timeline.metric', 'timeline.columns', 'timeline.sort', 'timeline.dir'].includes(name);
  let fields = [...keys];
  if (area === 'repository' && keys.some(dependent)) {
    fields = [...new Set([...keys, 'timeline.kind', 'timeline.family'])];
    if (['timeline.kind', 'timeline.family'].some((name) => saved.get(name) !== params.get(name)))
      for (const name of [...saved.keys()])
        if (dependent(name) && !fields.includes(name)) saved.delete(name);
  }
  for (const name of fields) {
    saved.delete(name);
    for (const value of params.getAll(name)) saved.append(name, value);
  }
  return JSON.parse(serializeTimelinePreferences(saved, area)) as unknown;
}
/** The stored presentation section as the cookie copies it, or null when unreadable. */
export function storedTimelinePreferences(raw: string | null, area: TimelineArea): unknown {
  const stored = readTimelinePreferences(raw, area);
  return stored && (JSON.parse(serializeTimelinePreferences(stored, area)) as unknown);
}

const linkRepositories = repositoryCatalog
  .filter((row) => row.enabled)
  .map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.displayName,
    primaryBranch: row.primaryBranch === 'main' ? ('main' as const) : ('master' as const),
  }));
/**
 * A link into a Timeline with the viewer's saved presentation (decision C3): the values its entry
 * would open at, as the Timeline resolves an entry (explicit fields win per domain, and a saved
 * choice that does not fit is left out). `explicit` names the fields the link sets even at their
 * v1 defaults, so a saved value never replaces them; such a link is pinned with `v`, since one
 * left with only selectors would be an entry the Timeline resolves again. Without a saved section,
 * or when the link's view cannot take it, the link's own values.
 */
export function savedTimelineLink(
  route: UrlRoute,
  values: UrlValues,
  explicit: readonly string[],
  saved: string | null,
  asOf: string,
): UrlValues {
  if (!saved) return values;
  const pin: UrlValues = explicit.length ? { v: '1' } : {};
  const pinned: Record<string, UrlValue> = { ...values };
  for (const name of explicit)
    if (pinned[name] === undefined) {
      const fallback = defaultValue(route, name, values);
      if (fallback !== undefined) pinned[name] = fallback;
    }
  const query = timelineQuery(route, pinned, asOf);
  const period = periodSelection(typeof pinned.period === 'string' ? pinned.period : 'this-year');
  if (query === null || !period) return { ...values, ...pin };
  const entry = new URLSearchParams(query);
  entry.delete('timeline.state');
  const screen = timelineScreen(route);
  const area: TimelineArea =
    screen === 'matrix'
      ? 'matrix'
      : screen === 'repositoryTimeline'
        ? 'repository'
        : 'contribution';
  const context = {
    area,
    path: '/',
    asOf,
    period,
    repositories: linkRepositories,
  } as unknown as TimelineControlContext;
  const resolved = resolveTimelineEntry(entry.toString(), context, { presentation: saved });
  const target =
    resolved.kind === 'redirect' &&
    timelineStateValues(route, resolved.search, asOf, { repositories: linkRepositories });
  if (!target) return { ...values, ...pin };
  const back: UrlValues = values.back === undefined ? {} : { back: values.back };
  return { ...withoutDefaults(route, target), ...back, ...pin };
}
