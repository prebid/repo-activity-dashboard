import { readTimelineSource, readTimelineView } from './url/legacy/timeline';
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
} from './contribution-settings';
import type { ContributionSettings } from '@/models/contribution-settings';
import { preferenceSectionKeys, type PreferenceSectionKey } from '@/models/preferences';

import { z } from 'zod';
import { contributionUrlFits } from './contribution-return';
import { canonicalRoutePath } from './navigation';
import { readRepositoryFilterValues } from './repository-page-query';
import { validateRepositoryTimelineFilters } from './repository-timeline';

import { assertMatrixCellLimit, matrixRepositoryIds } from './repository-timeline-matrix';
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
export function resolveTimelinePresentation(
  path: string,
  search: string,
  context: TimelineControlContext,
) {
  const source = new URL(context.href, 'https://dashboard.invalid');
  const key = timelineDataKey(search, context);
  if (
    canonicalRoutePath(path) === canonicalRoutePath(context.path) &&
    key !== null &&
    key === timelineDataKey(source.search, context)
  ) {
    try {
      return {
        view: readTimelineView(new URLSearchParams(search), context.area, context.asOf).view,
        awaitingData: false,
      };
    } catch {
      /* The server owns invalid-link rendering. Keep the current model coherent during navigation. */
    }
  }
  return { view: context.view, awaitingData: true };
}
