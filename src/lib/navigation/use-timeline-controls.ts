'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { TimelineControlContext, TimelineViewState } from '@/models/timeline-controls';
import type { PeriodSelection } from '@/models/reporting-period';
import type { RepositoryPageFilters } from '@/models/repository-page';
import type { ContributionSettings } from '@/models/contribution-settings';
import type { ContributionOptions } from '@/models/contribution-options';
import type { TableController } from '@/lib/presentation/table-controller';
import {
  resolveTimelinePresentation,
  writeTimelineView,
  writeTimelinePeriod,
  timelinePreferenceKey,
  readTimelinePreferences,
  serializeTimelinePreferences,
  validateTimelineProposal,
  mergeTimelinePreferenceParameters,
  timelinePreferenceCandidates,
} from '@/lib/presentation/timeline-controls';
import {
  contributionPreferenceKey,
  readContributionPreferenceCandidate,
  contributionPreferenceNeedsLookup,
  hasContributionScope,
  writeContributionSettings,
  defaultContributionSettings,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import { writeRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import {
  clearContributionScope,
  discardContributionScope,
  saveContributionScope,
  savedScopeLookupTimeoutMs,
} from './contribution-scope-storage';

function checkedTarget(input: string, context: TimelineControlContext) {
  const checked = validateTimelineProposal(input, context);
  const target = writeTimelineView(input, context.area, checked.view);
  if (!contributionUrlFits(context.path + '?' + target))
    throw Error('This view is too large for a link. Reduce the selection.');
  return target;
}

/** One URL owner for Timeline state. Facts remain in authenticated server composition. */
export function useTimelineControls(
  viewerId: string,
  context: TimelineControlContext,
  defaults: Record<string, boolean>,
  options?: ContributionOptions,
) {
  const router = useRouter(),
    search = useSearchParams().toString();
  // Explicit-state links never consult browser preferences, so their first render is final.
  const [pending, startTransition] = useTransition(),
    [restoring, setRestoring] = useState(() => !new URLSearchParams(search).has('timeline.state')),
    [notice, setNotice] = useState<string>();
  const [storageAvailable, setStorageAvailable] = useState(true);
  const busy = useRef(false);
  useEffect(() => {
    if (!pending) busy.current = false;
  }, [pending]);
  const key = timelinePreferenceKey(viewerId, context);
  const scopeKey = contributionPreferenceKey(viewerId, context.sample.split(':')[0]);
  const pathname = usePathname();
  const { view, awaitingData } = resolveTimelinePresentation(pathname, search, context);
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
  useEffect(() => {
    if (
      resolveTimelinePresentation(window.location.pathname, window.location.search, context)
        .awaitingData
    ) {
      setRestoring(false);
      return;
    }
    if (new URLSearchParams(window.location.search).has('timeline.state')) {
      setRestoring(false);
      return;
    }
    const controller = new AbortController();
    const before = window.location.pathname + window.location.search;
    busy.current = false;
    setRestoring(true);
    const current = () =>
      !controller.signal.aborted && window.location.pathname + window.location.search === before;
    const timeout = setTimeout(() => {
      if (current()) {
        controller.abort();
        setRestoring(false);
        setNotice('Saved preferences could not be checked. Reload to retry.');
      }
    }, savedScopeLookupTimeoutMs);
    void (async () => {
      const explicit = new URLSearchParams(window.location.search);
      let params = explicit;
      let raw: string | null = null,
        scopeRaw: string | null = null;
      try {
        raw = localStorage.getItem(key);
        scopeRaw = context.contribution ? localStorage.getItem(scopeKey) : null;
      } catch {
        setStorageAvailable(false);
        return;
      }
      const stored = readTimelinePreferences(raw, context.area);
      if (!stored) {
        setNotice('Saved Timeline preferences are invalid. Defaults are shown.');
        if (localStorage.getItem(key) === raw) localStorage.removeItem(key);
        return;
      }
      params = mergeTimelinePreferenceParameters(params, stored);
      if (
        context.contribution &&
        !hasContributionScope(new URLSearchParams(window.location.search)) &&
        scopeRaw !== null
      ) {
        let settings = readContributionPreferenceCandidate(
          scopeRaw,
          { repositories: context.repositories },
          context.asOf,
        );
        if (settings) {
          try {
            validateTimelineProposal(
              writeContributionSettings(params.toString(), settings),
              context,
            );
          } catch {
            setNotice(
              'Saved filters are too large or incompatible with this Timeline. The requested view is unchanged.',
            );
            return;
          }
        }
        if (settings && contributionPreferenceNeedsLookup(settings))
          settings = await options!.validate(settings, controller.signal);
        if (!current()) return;
        if (localStorage.getItem(scopeKey) !== scopeRaw) {
          setNotice('Saved filters changed while loading. Reload to use the latest settings.');
          return;
        }
        if (!settings) {
          setNotice('Saved filters could not be restored. Default filters are shown.');
          discardContributionScope(scopeKey, scopeRaw);
          return;
        }
        const selected = new URLSearchParams(
          writeContributionSettings(params.toString(), settings),
        );
        for (const name of [...params.keys()]) params.delete(name);
        for (const [name, value] of selected) params.append(name, value);
      }
      if (!current()) return;
      if (localStorage.getItem(key) !== raw) {
        setNotice(
          'Saved Timeline preferences changed while loading. Reload to use the latest settings.',
        );
        return;
      }
      let next: string | undefined,
        skipped = false;
      for (const candidate of timelinePreferenceCandidates(
        new URLSearchParams(
          params.has('period') ? params : writeTimelinePeriod(params.toString(), context.period),
        ),
        explicit,
      ))
        try {
          next = checkedTarget(candidate.toString(), context);
          break;
        } catch {
          skipped = true;
        }
      if (next === undefined)
        setNotice(
          'Saved Timeline preferences do not fit this report. The requested view is unchanged.',
        );
      else {
        if (skipped) setNotice('Saved Timeline choices that do not fit this report were skipped.');
        if (next !== window.location.search.slice(1)) {
          // Presentation restoration reuses the loaded facts, just like ordinary table edits.
          const href = context.path + '?' + next;
          if (resolveTimelinePresentation(context.path, next, context).awaitingData)
            startTransition(() => router.replace(href, { scroll: false }));
          else window.history.replaceState(null, '', href);
        }
      }
    })()
      .catch(() => {
        if (current())
          setNotice('Saved preferences could not be checked. The requested view is unchanged.');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!controller.signal.aborted) setRestoring(false);
      });
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [key, scopeKey, context, options, router]);
  function remember(params: URLSearchParams, keys: string[]) {
    try {
      const prior =
        readTimelinePreferences(localStorage.getItem(key), context.area) ?? new URLSearchParams();
      if (keys.includes('timeline.kind') || keys.includes('timeline.family'))
        for (const name of [...prior.keys()]) if (/^(prs|issues)\./.test(name)) prior.delete(name);
      // Kind-specific choices are saved with their kind and family, so other kinds skip them.
      const saved =
        context.area === 'repository' &&
        keys.some((name) =>
          ['timeline.metric', 'timeline.columns', 'timeline.sort', 'timeline.dir'].includes(name),
        )
          ? [...new Set([...keys, 'timeline.kind', 'timeline.family'])]
          : keys;
      for (const name of saved) {
        prior.delete(name);
        for (const value of params.getAll(name)) prior.append(name, value);
      }
      localStorage.setItem(key, serializeTimelinePreferences(prior, context.area));
    } catch {
      setStorageAvailable(false);
    }
  }
  function apply(next: string, scope: boolean, rememberKeys: string[] = []) {
    if (busy.current || pending || restoring || awaitingData)
      return 'The current update is still loading. Try again when it finishes.';
    let target;
    try {
      target = checkedTarget(next, context);
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
    try {
      saveContributionScope(
        scopeKey,
        { repositories: context.repositories },
        context.asOf,
        value,
        field,
      );
    } catch {
      setStorageAvailable(false);
    }
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
    if (!error)
      try {
        localStorage.removeItem(key);
      } catch {
        setStorageAvailable(false);
      }
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
    if (!error)
      try {
        clearContributionScope(scopeKey);
      } catch {
        setStorageAvailable(false);
      }
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
      if (!pending && !restoring && !awaitingData) {
        const params = new URLSearchParams(window.location.search);
        params.set('timeline.page', String(page));
        window.history.replaceState(null, '', context.path + '?' + params.toString());
      }
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
    pending: pending || restoring || awaitingData,
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
