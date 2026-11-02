'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { TimelineControlContext, TimelineViewState } from '@/models/timeline-controls';
import type { PeriodSelection } from '@/models/reporting-period';
import type { RepositoryPageFilters } from '@/models/repository-page';
import type { ContributionSettings } from '@/models/contribution-settings';
import type { TableController } from '@/lib/presentation/table-controller';
import {
  resolveTimelinePresentation,
  writeTimelineView,
  writeTimelinePeriod,
  timelinePreferenceKey,
  readTimelinePreferences,
  serializeTimelinePreferences,
  timelineTarget,
} from '@/lib/presentation/timeline-controls';
import {
  readContributionPreferenceCandidate,
  writeContributionSettings,
  defaultContributionSettings,
  mergeContributionPreferences,
  serializeContributionPreferences,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import { writeRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import { readPreference, usePreferenceCookie } from './use-preference-cookie';

/**
 * One URL owner for Timeline state. Facts remain in authenticated server composition, which also
 * applies saved preferences to an entry URL before the first render; this hook only saves
 * deliberate changes, through the sections in `context.preferences`.
 */
export function useTimelineControls(
  viewerId: string,
  context: TimelineControlContext,
  defaults: Record<string, boolean>,
) {
  const router = useRouter(),
    search = useSearchParams().toString();
  const [pending, startTransition] = useTransition();
  // A notice from this page's own edits replaces the server's entry notice for the same model.
  const [ownNotice, setOwnNotice] = useState<{ href: string; text?: string }>();
  const notice = ownNotice?.href === context.href ? ownNotice.text : context.preferences?.notice;
  const setNotice = (text?: string) => setOwnNotice({ href: context.href, text });
  const saved = context.preferences;
  const key = timelinePreferenceKey(viewerId, context);
  // The former localStorage value is copied once, for the next entry; this render is unchanged.
  const presentationCookie = usePreferenceCookie(saved?.presentation, {
    keys: [key],
    read: (raw) => {
      const stored = readTimelinePreferences(raw, context.area);
      return stored && (JSON.parse(serializeTimelinePreferences(stored, context.area)) as unknown);
    },
  });
  const scopeCookie = usePreferenceCookie(saved?.scope);
  const storageAvailable = presentationCookie.storageAvailable && scopeCookie.storageAvailable;
  const busy = useRef(false);
  useEffect(() => {
    if (!pending) busy.current = false;
  }, [pending]);
  const pathname = usePathname();
  const resolved = resolveTimelinePresentation(pathname, search, context);
  const awaitingData = resolved.awaitingData;
  // A page past the last one shows the last page; the correction is kept for this address only,
  // without a history write, and the next deliberate change writes it.
  const [correction, setCorrection] = useState<{ search: string; page: number }>();
  const view =
    !awaitingData && correction?.search === search
      ? { ...resolved.view, page: correction.page }
      : resolved.view;
  const activeSearch = awaitingData
    ? new URL(context.href, 'https://dashboard.invalid').search
    : search;
  function canonical(input: string, current = view) {
    let result = input;
    if (!new URLSearchParams(result).has('period'))
      result = writeTimelinePeriod(result, context.period);
    if (context.contribution) result = writeContributionSettings(result, context.contribution);
    return writeTimelineView(result, context.area, current);
  }
  function remember(params: URLSearchParams, keys: string[]) {
    if (!saved) return;
    const prior =
      readTimelinePreferences(
        readPreference(saved.presentation.binding, saved.presentation.section),
        context.area,
      ) ?? new URLSearchParams();
    const dependent = (name: string) =>
      /^(prs|issues)\./.test(name) ||
      ['timeline.metric', 'timeline.columns', 'timeline.sort', 'timeline.dir'].includes(name);
    let fields = keys;
    // Kind-specific choices are saved with their kind and family, and replace another kind's.
    if (context.area === 'repository' && keys.some(dependent)) {
      fields = [...new Set([...keys, 'timeline.kind', 'timeline.family'])];
      if (['timeline.kind', 'timeline.family'].some((name) => prior.get(name) !== params.get(name)))
        for (const name of [...prior.keys()])
          if (dependent(name) && !fields.includes(name)) prior.delete(name);
    }
    for (const name of fields) {
      prior.delete(name);
      for (const value of params.getAll(name)) prior.append(name, value);
    }
    presentationCookie.write(JSON.parse(serializeTimelinePreferences(prior, context.area)));
  }
  function apply(next: string, scope: boolean, rememberKeys: string[] = []) {
    if (busy.current || pending || awaitingData)
      return 'The current update is still loading. Try again when it finishes.';
    let target;
    try {
      target = timelineTarget(next, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid Timeline change.';
      setNotice(message);
      return message;
    }
    setNotice(undefined);
    const before = canonical(window.location.search);
    if (
      contributionUrlFits(context.path + '?' + before) &&
      context.path + '?' + before !== window.location.pathname + window.location.search
    )
      window.history.replaceState(null, '', context.path + '?' + before);
    if (rememberKeys.length) remember(new URLSearchParams(target), rememberKeys);
    if (scope) {
      busy.current = true;
      startTransition(() => router.push(context.path + '?' + target, { scroll: false }));
    } else window.history.pushState(null, '', context.path + '?' + target);
  }
  function changeView(patch: Partial<TimelineViewState>) {
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
    let next = writeTimelineView(canonical(window.location.search), context.area, nextView);
    const params = new URLSearchParams(next);
    if ('grouping' in patch) {
      params.delete('timeline.window');
      if (context.area === 'matrix') {
        params.set('timeline.sort', 'repository');
        params.set('timeline.dir', 'asc');
      }
    }
    if ('kind' in patch || 'family' in patch) {
      for (const name of [...params.keys()])
        if (/^(prs|issues)\./.test(name) || name === 'timeline.columns') params.delete(name);
      params.delete('timeline.metric');
      params.set('timeline.sort', 'period');
      params.set('timeline.dir', 'asc');
    }
    const fieldNames: Partial<Record<keyof TimelineViewState, string>> = {
      grouping: 'group',
      kind: 'kind',
      family: 'family',
      metric: context.area === 'matrix' ? 'rank' : 'metric',
      selectedMetrics: 'metric',
      chart: 'chart',
      sort: 'sort',
      descending: 'dir',
      columns: 'columns',
    };
    const keys = Object.keys(patch).flatMap((k) =>
      fieldNames[k as keyof TimelineViewState]
        ? ['timeline.' + fieldNames[k as keyof TimelineViewState]]
        : [],
    );
    if ('kind' in patch || 'family' in patch)
      keys.push(
        'timeline.metric',
        'timeline.columns',
        'timeline.sort',
        'timeline.dir',
        ...Array.from(new URLSearchParams(window.location.search).keys()).filter((k) =>
          /^(prs|issues)\./.test(k),
        ),
      );
    if ('selectedMetrics' in patch) keys.push('timeline.rank');
    if ('grouping' in patch && context.area === 'matrix')
      keys.push('timeline.sort', 'timeline.dir');
    next = params.toString();
    return apply(next, scope, keys);
  }
  function period(value: PeriodSelection) {
    const params = new URLSearchParams(
      writeTimelinePeriod(canonical(window.location.search), value),
    );
    params.delete('timeline.window');
    params.set('timeline.page', '1');
    if (context.area === 'matrix') {
      params.set('timeline.sort', 'repository');
      params.set('timeline.dir', 'asc');
    }
    return apply(params.toString(), true, [
      'period',
      'from',
      'through',
      ...(context.area === 'matrix' ? ['timeline.sort', 'timeline.dir'] : []),
    ]);
  }
  function repositories(ids: string[]) {
    const params = new URLSearchParams(canonical(window.location.search));
    params.delete('repo');
    if (!ids.length) params.set('repo', '');
    else for (const id of ids) params.append('repo', id);
    params.set('timeline.page', '1');
    return apply(params.toString(), true, ['repo']);
  }
  function filters(value: RepositoryPageFilters) {
    const params = new URLSearchParams(
      writeRepositoryFilters(canonical(window.location.search), value),
    );
    params.set('timeline.page', '1');
    const keys = [
      ...new Set([...new URLSearchParams(window.location.search).keys(), ...params.keys()]),
    ].filter((k) => /^(prs|issues)\./.test(k));
    return apply(params.toString(), true, keys);
  }
  function contribution(value: ContributionSettings, field: ContributionSettingField) {
    const params = new URLSearchParams(
      writeContributionSettings(canonical(window.location.search), value),
    );
    for (const name of ['timeline.from', 'timeline.to', 'timeline.inclusive'])
      if (field === 'period') params.delete(name);
    params.set('timeline.page', '1');
    params.delete('timeline.window');
    const error = apply(params.toString(), true);
    if (error) return error;
    if (!saved?.scope) return;
    const directory = { repositories: context.repositories };
    const prior =
      readContributionPreferenceCandidate(
        readPreference(saved.scope.binding, saved.scope.section),
        directory,
        context.asOf,
      ) ?? defaultContributionSettings(directory);
    scopeCookie.write(
      JSON.parse(
        serializeContributionPreferences(mergeContributionPreferences(prior, value, field)),
      ),
    );
  }
  function reset() {
    const params = new URLSearchParams(canonical(window.location.search));
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
    const error = apply(params.toString(), true);
    if (!error) presentationCookie.write(null);
  }
  function resetContribution() {
    const params = new URLSearchParams(
      writeContributionSettings(
        canonical(window.location.search),
        defaultContributionSettings({ repositories: context.repositories }),
      ),
    );
    params.set('timeline.page', '1');
    for (const name of ['timeline.from', 'timeline.to', 'timeline.inclusive']) params.delete(name);
    const error = apply(params.toString(), true);
    if (!error) scopeCookie.write(null);
  }
  const query = { search: '', sort: view.sort, descending: view.descending, page: view.page };
  const table: TableController = {
    scopeKey: key,
    query,
    draftSearch: '',
    setSearch: () => {},
    flushSearch: () => query,
    update: (patch) =>
      changeView({
        ...(patch.sort !== undefined ? { sort: patch.sort } : {}),
        ...(patch.descending !== undefined ? { descending: patch.descending } : {}),
        ...(patch.page !== undefined ? { page: patch.page } : {}),
      }),
    reconcilePage: (page) => {
      if (!pending && !awaitingData) setCorrection({ search, page });
    },
  };
  return {
    view,
    period: context.period,
    changeView,
    changePeriod: period,
    changeRepositories: repositories,
    changeFilters: filters,
    changeContribution: contribution,
    reset,
    resetContribution,
    table,
    pending: pending || awaitingData,
    notice,
    storageAvailable,
    href: context.path + '?' + canonical(activeSearch),
    visibility: {
      value: view.columns
        ? Object.fromEntries(context.metricIds.map((id) => [id, view.columns!.includes(id)]))
        : defaults,
      onChange: (next: Record<string, boolean>) =>
        changeView({ columns: context.metricIds.filter((id) => next[id] !== false) }),
    },
  };
}
