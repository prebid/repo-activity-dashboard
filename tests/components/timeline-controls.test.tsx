import { useMemo, useSyncExternalStore } from 'react';
import {
  act as reactAct,
  renderHook,
  waitFor,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useTimelineControls } from '@/lib/navigation/use-timeline-controls';
import { readTimelineView, timelinePreferenceKey } from '@/lib/presentation/timeline-controls';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import {
  readContributionSettings,
  contributionPreferenceKey,
  serializeContributionPreferences,
  defaultContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { readRepositoryFilterValues } from '@/lib/presentation/repository-page-query';
import { localContributionOptions } from '../support/contribution-options';
import type { TimelineArea, TimelineControlContext } from '@/models/timeline-controls';
import type { ContributionOptions } from '@/models/contribution-options';
import type { ContributionSettings } from '@/models/contribution-settings';
import { TimelineControls } from '@/components/reporting/timeline-controls';
import { TimelineMetricsSelector } from '@/components/reporting/timeline-metrics-selector';
async function interact(action: () => unknown) {
  await reactAct(async () => {
    action();
    await Promise.resolve();
  });
}
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const subscribe = (notify: () => void) => {
  window.addEventListener('test-navigation', notify);
  window.addEventListener('popstate', notify);
  return () => {
    window.removeEventListener('test-navigation', notify);
    window.removeEventListener('popstate', notify);
  };
};
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => useSyncExternalStore(subscribe, () => window.location.pathname),
  useSearchParams: () =>
    new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
}));
const source = contributionSample(),
  asOf = contributionSampleAsOf;
function makeContext(area: TimelineArea, search: string): TimelineControlContext {
  const parsed = readTimelineView(new URLSearchParams(search), area, asOf);
  return {
    area,
    path:
      area === 'contribution'
        ? '/contributors'
        : area === 'repository'
          ? '/repos/prebidjs'
          : '/repos',
    href:
      (area === 'contribution'
        ? '/contributors'
        : area === 'repository'
          ? '/repos/prebidjs'
          : '/repos') +
      '?' +
      new URLSearchParams(search).toString(),
    sample: 'reference',
    preferenceScope: area,
    asOf,
    ...parsed,
    repositories: source.repositories,
    ...(area === 'matrix'
      ? { repositoryIds: source.repositories.map((r) => r.id) }
      : area === 'contribution'
        ? { contribution: readContributionSettings(new URLSearchParams(search), source, asOf)! }
        : { filters: readRepositoryFilterValues(search, parsed.view.kind)! }),
  };
}
function useControls(
  area: TimelineArea = 'matrix',
  viewer = 'alice',
  suppliedOptions?: ContributionOptions,
) {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  const context = useMemo(() => makeContext(area, search), [area, search]);
  const options = useMemo(() => localContributionOptions(source, asOf), []);
  return {
    ...useTimelineControls(
      viewer,
      context,
      { prsOpened: true, prsAuthored: true },
      suppliedOptions ?? options,
    ),
    context,
  };
}
beforeEach(() => {
  window.history.replaceState(null, '', '/repos?timeline=1');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation(
      (state: unknown, unused: string, url?: string | URL | null) => {
        original(state, unused, url);
        window.dispatchEvent(new Event('test-navigation'));
      },
    );
  }
  navigation.push
    .mockReset()
    .mockImplementation((href: string) => window.history.pushState(null, '', href));
  navigation.replace
    .mockReset()
    .mockImplementation((href: string) => window.history.replaceState(null, '', href));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function ready(result: { current: { pending: boolean } }) {
  await waitFor(() => expect(result.current.pending).toBe(false));
}
it.each(['matrix', 'repository', 'contribution'] as const)(
  'restores %s presentation without requesting the same server data again',
  async (area) => {
    const path =
      area === 'matrix' ? '/repos' : area === 'repository' ? '/repos/prebidjs' : '/contributors';
    window.history.replaceState(null, '', path + '?timeline=1');
    const context = makeContext(area, window.location.search);
    localStorage.setItem(
      timelinePreferenceKey('alice', context),
      JSON.stringify({ version: 1, query: 'timeline.dir=desc' }),
    );
    const { result } = renderHook(() => useControls(area));
    await ready(result);
    expect(result.current.view.descending).toBe(true);
    expect(new URLSearchParams(window.location.search).get('timeline.state')).toBe('1');
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  },
);
it('restores versioned preferences once, freezes Back state and keeps row/window pages independent', async () => {
  const key = timelinePreferenceKey('alice', makeContext('matrix', 'timeline=1'));
  localStorage.setItem(
    key,
    JSON.stringify({ version: 1, query: 'timeline.group=day&period=this-year' }),
  );
  const { result } = renderHook(() => useControls());
  await ready(result);
  expect(result.current.view.grouping).toBe('day');
  expect(result.current.view.window).toBe(25);
  expect(navigation.replace).toHaveBeenCalledTimes(1);
  const before = window.location.href;
  await interact(() => {
    result.current.changeView({ window: 24 });
  });
  await ready(result);
  expect(result.current.view.window).toBe(24);
  expect(result.current.view.page).toBe(1);
  await interact(() => result.current.table.update({ page: 2 }));
  await ready(result);
  expect(result.current.view.page).toBe(2);
  expect(result.current.view.window).toBe(24);
  expect(localStorage.getItem(key)).not.toContain('timeline.page');
  expect(localStorage.getItem(key)).not.toContain('timeline.window');
  await interact(() => result.current.table.reconcilePage(1));
  await ready(result);
  expect(result.current.view.page).toBe(1);
  await interact(() => result.current.changeView({ grouping: 'week' }));
  await ready(result);
  expect(result.current.view.window).toBe(4);
  expect(result.current.view.page).toBe(1);
  await interact(() => window.history.replaceState(null, '', before));
  await ready(result);
  expect(result.current.view.grouping).toBe('day');
  expect(result.current.table.flushSearch().search).toBe('');
  const search = window.location.search;
  await interact(() => result.current.table.setSearch('ignored'));
  // Timeline tables have no search; typing must not change the URL or the query.
  expect(window.location.search).toBe(search);
  expect(result.current.table.query.search).toBe('');
});
it('honors explicit state, isolates accounts and rejects oversized edits without storing or moving', async () => {
  const ctx = makeContext('matrix', 'timeline=1');
  const key = timelinePreferenceKey('alice', ctx);
  localStorage.setItem(key, JSON.stringify({ version: 1, query: 'timeline.group=week' }));
  window.history.replaceState(null, '', '/repos?timeline=1&timeline.state=1&timeline.group=day');
  const { result, rerender } = renderHook(({ viewer }) => useControls('matrix', viewer), {
    initialProps: { viewer: 'alice' },
  });
  await ready(result);
  expect(result.current.view.grouping).toBe('day');
  const url = window.location.href,
    raw = localStorage.getItem(key);
  await interact(() =>
    expect(
      result.current.changePeriod({ kind: 'custom', from: '2020-01-01', through: '2026-10-24' }),
    ).toContain('500'),
  );
  expect(window.location.href).toBe(url);
  expect(localStorage.getItem(key)).toBe(raw);
  await interact(() => result.current.changeRepositories(['unknown']));
  expect(result.current.notice).toContain('no longer available');
  await interact(() => result.current.changeRepositories([]));
  await ready(result);
  expect(new URLSearchParams(window.location.search).get('repo')).toBe('');
  await interact(() => result.current.changePeriod({ kind: 'preset', preset: 'last-week' }));
  await ready(result);
  expect(result.current.context.period).toEqual({ kind: 'preset', preset: 'last-week' });
  rerender({ viewer: 'bob' });
  await ready(result);
  expect(localStorage.getItem(timelinePreferenceKey('bob', ctx))).toBeNull();
  await interact(() => result.current.reset());
  await ready(result);
  expect(result.current.view.grouping).toBe('month');
});
it('handles invalid, incompatible and unavailable storage while retaining usable links', async () => {
  const ctx = makeContext('matrix', 'timeline=1'),
    key = timelinePreferenceKey('alice', ctx);
  localStorage.setItem(key, 'bad');
  const first = renderHook(() => useControls());
  await ready(first.result);
  expect(first.result.current.notice).toContain('invalid');
  expect(localStorage.getItem(key)).toBeNull();
  first.unmount();
  localStorage.setItem(key, JSON.stringify({ version: 1, query: 'timeline.metric=unknown' }));
  const second = renderHook(() => useControls());
  await ready(second.result);
  expect(second.result.current.notice).toBe(
    'Saved Timeline choices that do not fit this report were skipped.',
  );
  second.unmount();
  window.history.replaceState(null, '', '/repos?timeline=1');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('disabled');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('disabled');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error('disabled');
  });
  const third = renderHook(() => useControls());
  await ready(third.result);
  expect(third.result.current.storageAvailable).toBe(false);
  await interact(() => third.result.current.changeView({ grouping: 'week' }));
  await ready(third.result);
  expect(third.result.current.view.grouping).toBe('week');
  await interact(() => third.result.current.reset());
  await ready(third.result);
  expect(third.result.current.view.grouping).toBe('month');
  expect(third.result.current.storageAvailable).toBe(false);
});
it('keeps repository predicates across grouping changes and clears them on deliberate family changes', async () => {
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1');
  const { result } = renderHook(() => useControls('repository'));
  await ready(result);
  await interact(() =>
    result.current.changeFilters({
      ...result.current.context.filters!,
      authors: ['sample-alice'],
      search: 'keyword',
    }),
  );
  await ready(result);
  expect(result.current.context.filters!.authors).toEqual(['sample-alice']);
  await interact(() => result.current.changeView({ grouping: 'week' }));
  await ready(result);
  expect(result.current.context.filters!.search).toBe('keyword');
  await interact(() => result.current.changeView({ family: 'snapshot' }));
  await ready(result);
  expect(result.current.context.filters!.authors).toEqual([]);
  expect(result.current.view.metric).toBe('totalOpenPrs');
  await interact(() => result.current.visibility.onChange({ totalOpenPrs: true }));
  await ready(result);
  expect(result.current.visibility.value.totalOpenPrs).toBe(true);
  await interact(() => result.current.changeView({ chart: true }));
  await ready(result);
  expect(result.current.view.chart).toBe(true);
  await interact(() =>
    result.current.table.update({ sort: 'totalOpenPrs', descending: true, page: 1 }),
  );
  await ready(result);
  expect(result.current.table.query.sort).toBe('totalOpenPrs');
  await interact(() => result.current.changeView({ kind: 'issues' }));
  await ready(result);
  expect(result.current.view.metric).toBe('openIssues');
});
it('reuses contribution scope preferences and preserves list-only search separately', async () => {
  window.history.replaceState(null, '', '/contributors?timeline=1&report.q=Alice');
  const saved = defaultContributionSettings(source);
  saved.selection.actorTypes = ['agent'];
  localStorage.setItem(
    contributionPreferenceKey('alice', 'reference'),
    serializeContributionPreferences(saved),
  );
  const { result } = renderHook(() => useControls('contribution'));
  await ready(result);
  expect(result.current.context.contribution!.selection.actorTypes).toEqual(['agent']);
  const next = {
    ...result.current.context.contribution!,
    period: { kind: 'preset' as const, preset: 'last-month' as const },
  };
  await interact(() => result.current.changeContribution(next, 'period'));
  await ready(result);
  expect(localStorage.getItem(contributionPreferenceKey('alice', 'reference'))).toContain(
    'last-month',
  );
  expect(localStorage.getItem(timelinePreferenceKey('alice', result.current.context))).toBeNull();
  expect(new URLSearchParams(window.location.search).get('report.q')).toBe('Alice');
  await interact(() => result.current.resetContribution());
  await ready(result);
  expect(localStorage.getItem(contributionPreferenceKey('alice', 'reference'))).toBeNull();
});
it('does not apply a delayed account lookup after navigation or remove a concurrently replaced saved value', async () => {
  const saved = defaultContributionSettings(source);
  saved.selection.excludedAccountIds = ['account-alice'];
  const key = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(key, serializeContributionPreferences(saved));
  let resolve!: (value: ContributionSettings | null) => void;
  const options = {
    ...localContributionOptions(source, asOf),
    validate: vi.fn(
      () =>
        new Promise<ContributionSettings | null>((r) => {
          resolve = r;
        }),
    ),
  };
  window.history.replaceState(null, '', '/contributors?timeline=1');
  const first = renderHook(() => useControls('contribution', 'alice', options));
  await waitFor(() => expect(options.validate).toHaveBeenCalledOnce());
  const replacement = serializeContributionPreferences({
    ...saved,
    period: { kind: 'preset', preset: 'last-month' },
  });
  localStorage.setItem(key, replacement);
  await interact(() => {
    resolve(null);
  });
  await ready(first.result);
  expect(localStorage.getItem(key)).toBe(replacement);
  expect(first.result.current.notice).toContain('changed');
  first.unmount();
  window.history.replaceState(null, '', '/contributors?timeline=1');
  const second = renderHook(() => useControls('contribution', 'alice', options));
  await waitFor(() => expect(options.validate).toHaveBeenCalledTimes(2));
  await interact(() =>
    window.history.replaceState(
      null,
      '',
      '/contributors?timeline=1&timeline.state=1&period=this-week',
    ),
  );
  await interact(() => {
    resolve(saved);
  });
  await ready(second.result);
  expect(new URLSearchParams(window.location.search).get('period')).toBe('this-week');
});
it('retains rejected custom-date drafts in the shared Timeline controls', async () => {
  const user = userEvent.setup(),
    context = makeContext('matrix', 'timeline=1');
  render(
    <TimelineControls
      context={context}
      view={context.view}
      metrics={[]}
      pending={false}
      storageAvailable={false}
      onView={() => {}}
      onPeriod={() => 'Choose fewer than 501 intervals.'}
      onReset={() => {}}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Custom range for Reporting period' }));
  await user.clear(screen.getByLabelText('Start date'));
  await user.type(screen.getByLabelText('Start date'), '2020-01-01');
  await user.click(screen.getByRole('button', { name: 'Apply dates' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('501');
  expect(screen.getByLabelText('Start date')).toHaveValue('2020-01-01');
});
it('clears obsolete saved sort columns when grouping or family changes', async () => {
  window.history.replaceState(null, '', '/repos?timeline=1');
  const { result } = renderHook(() => useControls());
  await ready(result);
  await interact(() =>
    result.current.changeView({ sort: 'month:2026-08-01T00:00:00.000Z', descending: true }),
  );
  await ready(result);
  await interact(() => result.current.changeView({ grouping: 'week' }));
  await ready(result);
  const saved = localStorage.getItem(timelinePreferenceKey('alice', result.current.context))!;
  expect(saved).toContain('timeline.sort=repository');
  expect(saved).not.toContain('month%3A');
  await interact(() =>
    window.history.replaceState(null, '', '/repos?timeline=1&repo=repo-prebidjs'),
  );
  await ready(result);
  expect(result.current.view.grouping).toBe('week');
  expect(result.current.notice).toBeUndefined();
});
it('handles failed and invalid saved-account lookups without replacing newer Timeline preferences', async () => {
  const saved = defaultContributionSettings(source);
  saved.selection.excludedAccountIds = ['account-alice'];
  const scopeKey = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(scopeKey, serializeContributionPreferences(saved));
  window.history.replaceState(null, '', '/contributors?timeline=1');
  const failed = {
    ...localContributionOptions(source, asOf),
    validate: vi.fn().mockRejectedValue(Error('offline')),
  };
  const first = renderHook(() => useControls('contribution', 'alice', failed));
  await ready(first.result);
  expect(first.result.current.notice).toContain('could not be checked');
  expect(localStorage.getItem(scopeKey)).not.toBeNull();
  first.unmount();
  const invalid = { ...failed, validate: vi.fn().mockResolvedValue(null) };
  const second = renderHook(() => useControls('contribution', 'alice', invalid));
  await ready(second.result);
  expect(second.result.current.notice).toContain('could not be restored');
  expect(localStorage.getItem(scopeKey)).toBeNull();
  second.unmount();
  localStorage.setItem(scopeKey, serializeContributionPreferences(saved));
  let resolve!: (value: ContributionSettings | null) => void;
  const slow = {
    ...failed,
    validate: vi.fn(
      () =>
        new Promise<ContributionSettings | null>((r) => {
          resolve = r;
        }),
    ),
  };
  const third = renderHook(() => useControls('contribution', 'alice', slow));
  await waitFor(() => expect(slow.validate).toHaveBeenCalledOnce());
  const key = timelinePreferenceKey('alice', third.result.current.context),
    replacement = JSON.stringify({ version: 1, query: 'timeline.group=week' });
  localStorage.setItem(key, replacement);
  await interact(() => resolve(saved));
  await ready(third.result);
  expect(third.result.current.notice).toContain('Timeline preferences changed');
  expect(localStorage.getItem(key)).toBe(replacement);
});
it('times out a stalled saved lookup and rejects rapid edits until the current edit has been accepted', async () => {
  vi.useFakeTimers();
  window.history.replaceState(null, '', '/contributors?timeline=1');
  const saved = defaultContributionSettings(source);
  saved.selection.excludedAccountIds = ['account-alice'];
  localStorage.setItem(
    contributionPreferenceKey('alice', 'reference'),
    serializeContributionPreferences(saved),
  );
  const slow = {
    ...localContributionOptions(source, asOf),
    validate: () => new Promise<ContributionSettings | null>(() => {}),
  };
  const first = renderHook(() => useControls('contribution', 'alice', slow));
  expect(first.result.current.changeView({ grouping: 'week' })).toContain('still loading');
  await interact(() => vi.advanceTimersByTime(15000));
  expect(first.result.current.pending).toBe(false);
  expect(first.result.current.notice).toContain('Reload to retry');
  first.unmount();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/repos?timeline=1');
  const second = renderHook(() => useControls());
  await ready(second.result);
  let rejected: string | undefined;
  await interact(() => {
    second.result.current.changeView({ grouping: 'week' });
    rejected = second.result.current.changeView({ grouping: 'day' });
  });
  expect(rejected).toContain('still loading');
});
it('keeps rejected contribution edits and handles write failures and repository resets', async () => {
  window.history.replaceState(null, '', '/contributors?timeline=1');
  const first = renderHook(() => useControls('contribution'));
  await ready(first.result);
  const before = window.location.href;
  const settings = first.result.current.context.contribution!;
  await interact(() =>
    expect(
      first.result.current.changeContribution(
        {
          ...settings,
          selection: {
            ...settings.selection,
            excludedAccountIds: Array.from({ length: 1000 }, (_, i) => 'long-account-' + i),
          },
        },
        'population',
      ),
    ).toContain('too large'),
  );
  expect(window.location.href).toBe(before);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('quota');
  });
  await interact(() =>
    first.result.current.changeContribution(
      { ...settings, period: { kind: 'preset', preset: 'last-month' } },
      'period',
    ),
  );
  await ready(first.result);
  expect(first.result.current.storageAvailable).toBe(false);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error('quota');
  });
  await interact(() => first.result.current.resetContribution());
  await ready(first.result);
  expect(first.result.current.storageAvailable).toBe(false);
  first.unmount();
  vi.restoreAllMocks();
  window.history.replaceState(
    null,
    '',
    '/repos/prebidjs?timeline=1&timeline.state=1&timeline.kind=issues&timeline.family=snapshot',
  );
  const second = renderHook(() => useControls('repository'));
  await ready(second.result);
  await interact(() => second.result.current.reset());
  expect(navigation.push.mock.lastCall?.[0]).toContain('timeline.kind=issues');
});
it('disables scope edits while the URL has advanced beyond the supplied model, then resumes with matching data', async () => {
  window.history.replaceState(null, '', '/repos?timeline=1&timeline.state=1');
  const initial = makeContext('matrix', window.location.search);
  const { result, rerender } = renderHook(
    ({ context }) => useTimelineControls('alice', context, {}),
    { initialProps: { context: initial } },
  );
  await ready(result);
  await interact(() =>
    window.history.replaceState(
      null,
      '',
      '/repos?timeline=1&timeline.state=1&timeline.group=day&timeline.window=24',
    ),
  );
  expect(result.current.pending).toBe(true);
  expect(result.current.view.grouping).toBe('month');
  expect(result.current.view.window).toBe(1);
  expect(result.current.changeRepositories([])).toContain('still loading');
  rerender({ context: makeContext('matrix', window.location.search) });
  await ready(result);
  expect(result.current.view.window).toBe(24);
  expect(result.current.view.grouping).toBe('day');
  await interact(() =>
    window.history.replaceState(
      null,
      '',
      '/repos?timeline=1&timeline.state=1&timeline.group=month',
    ),
  );
  rerender({ context: { ...initial } });
  await ready(result);
  expect(result.current.view.window).toBe(1);
});
it('bounds restored contribution selections before requesting an identity lookup', async () => {
  window.history.replaceState(null, '', '/contributors?timeline=1');
  const saved = defaultContributionSettings(source);
  saved.selection.excludedAccountIds = Array.from({ length: 1000 }, (_, i) => 'long-account-' + i);
  const key = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(key, serializeContributionPreferences(saved));
  const options = { ...localContributionOptions(source, asOf), validate: vi.fn() };
  const { result } = renderHook(() => useControls('contribution', 'alice', options));
  await ready(result);
  expect(options.validate).not.toHaveBeenCalled();
  expect(result.current.notice).toContain('too large');
  expect(localStorage.getItem(key)).not.toBeNull();
});
it('does not let pagination rewrite the URL while another report scope is arriving', async () => {
  window.history.replaceState(null, '', '/repos?timeline=1&timeline.state=1');
  const original = makeContext('matrix', window.location.search);
  const { result } = renderHook(() => useTimelineControls('alice', original, {}));
  await ready(result);
  await interact(() =>
    window.history.replaceState(
      null,
      '',
      '/repos/prebidjs?timeline=1&timeline.state=1&timeline.page=4',
    ),
  );
  const requested = window.location.href;
  await interact(() => result.current.table.reconcilePage(1));
  expect(window.location.href).toBe(requested);
  expect(result.current.pending).toBe(true);
});
it('checks the final serialized URL before changing history or saved preferences', async () => {
  const params = new URLSearchParams(
    'timeline=1&period=this-year&timeline.state=1&timeline.group=month&timeline.metric=prsOpened&timeline.rank=prsOpened&timeline.sort=repository&timeline.dir=asc&timeline.page=1&timeline.window=1',
  );
  params.set('summary', '/repos?x=');
  const padding = 7498 - new TextEncoder().encode('/repos?' + params.toString()).length;
  params.set('summary', '/repos?x=' + 'a'.repeat(padding));
  window.history.replaceState(null, '', '/repos?' + params.toString());
  const { result } = renderHook(() => useControls());
  await ready(result);
  const before = window.location.href;
  await interact(() =>
    expect(result.current.changeView({ grouping: 'two-months' })).toContain('too large'),
  );
  expect(window.location.href).toBe(before);
  expect(localStorage.getItem(timelinePreferenceKey('alice', result.current.context))).toBeNull();
});
it('preserves a valid incoming URL when preference restoration would exceed the final link budget', async () => {
  const params = new URLSearchParams('timeline=1&period=this-year');
  params.set('summary', '/repos?x=');
  const padding = 7498 - new TextEncoder().encode('/repos?' + params.toString()).length;
  params.set('summary', '/repos?x=' + 'a'.repeat(padding));
  window.history.replaceState(null, '', '/repos?' + params.toString());
  const before = window.location.href;
  const { result } = renderHook(() => useControls());
  await ready(result);
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(window.location.href).toBe(before);
  expect(result.current.notice).toContain('do not fit');
});
it('restores compatible saved preferences when a saved metric belongs to the other record kind', async () => {
  window.history.replaceState(
    null,
    '',
    '/repos/prebidjs?timeline=1&timeline.kind=issues&timeline.family=activity',
  );
  const context = makeContext('repository', window.location.search);
  localStorage.setItem(
    timelinePreferenceKey('alice', context),
    JSON.stringify({
      version: 1,
      query: 'timeline.chart=1&timeline.metric=medianMergeDays&timeline.group=quarter',
    }),
  );
  const { result } = renderHook(() => useControls('repository'));
  await ready(result);
  expect(result.current.view).toMatchObject({ kind: 'issues', chart: true, grouping: 'quarter' });
  expect(result.current.view.metric).toBe('issuesOpened');
  expect(result.current.notice).toMatch(/skipped/);
});
it('saves the record kind with kind-specific choices so another kind ignores them', async () => {
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1');
  const context = makeContext('repository', window.location.search);
  const { result } = renderHook(() => useControls('repository'));
  await ready(result);
  await interact(() => result.current.changeView({ metric: 'medianMergeDays' }));
  const saved = new URLSearchParams(
    (
      JSON.parse(localStorage.getItem(timelinePreferenceKey('alice', context))!) as {
        query: string;
      }
    ).query,
  );
  expect([
    saved.get('timeline.metric'),
    saved.get('timeline.kind'),
    saved.get('timeline.family'),
  ]).toEqual(['medianMergeDays', 'prs', 'activity']);
});
it('keeps saved matrix metrics when a saved period-column sort no longer exists', async () => {
  window.history.replaceState(null, '', '/repos?timeline=1');
  const context = makeContext('matrix', window.location.search);
  localStorage.setItem(
    timelinePreferenceKey('alice', context),
    JSON.stringify({
      version: 1,
      query:
        'timeline.metric=prsOpened&timeline.metric=issuesOpened&timeline.sort=week:2026-10-19T00:00:00.000Z',
    }),
  );
  const { result } = renderHook(() => useControls('matrix'));
  await ready(result);
  expect(result.current.view.selectedMetrics).toEqual(['prsOpened', 'issuesOpened']);
  expect(result.current.view.sort).toBe('repository');
});
it('starts explicit-state links without a restoration gate', () => {
  window.history.replaceState(
    null,
    '',
    '/repos/prebidjs?timeline=1&timeline.state=1&period=this-year&timeline.group=month',
  );
  // The first render is what the server sends; effects have not run yet.
  const pending: boolean[] = [];
  renderHook(() => {
    const controls = useControls('repository');
    pending.push(controls.pending);
    return controls;
  });
  expect(pending[0]).toBe(false);
});
it('resets matrix ordering to ascending names on grouping changes and the row page on rank changes', async () => {
  window.history.replaceState(
    null,
    '',
    '/repos?timeline=1&timeline.state=1&timeline.metric=prsOpened&timeline.metric=issuesOpened&timeline.sort=month:2026-10-01T00:00:00.000Z&timeline.dir=desc&timeline.page=2',
  );
  const { result } = renderHook(() => useControls('matrix'));
  await ready(result);
  await interact(() => result.current.changeView({ metric: 'issuesOpened' }));
  expect(new URLSearchParams(window.location.search).get('timeline.page')).toBe('1');
  await ready(result);
  await interact(() => result.current.changeView({ grouping: 'quarter' }));
  const params = new URLSearchParams(window.location.search);
  expect([params.get('timeline.sort'), params.get('timeline.dir')]).toEqual(['repository', 'asc']);
});
it('names each Timeline control by its visible label', () => {
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1&timeline.state=1');
  const context = makeContext('repository', window.location.search);
  render(
    <TimelineControls
      context={context}
      view={context.view}
      metrics={[]}
      pending={false}
      storageAvailable
      onView={() => undefined}
      onPeriod={() => undefined}
      onReset={() => undefined}
      familyLabels={{ activity: 'Activity in each period', snapshot: 'Open at each cutoff' }}
    />,
  );
  for (const name of ['Group by', 'Records', 'Measure'])
    expect(screen.getByRole('combobox', { name })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /^Reporting period/ })).toBeInTheDocument();
  // The shared controls show the labels their caller supplies.
  expect(
    within(screen.getByRole('combobox', { name: 'Measure' }))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Activity in each period', 'Open at each cutoff']);
});
it('refuses to render repository Timeline controls without family labels', () => {
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1&timeline.state=1');
  const context = makeContext('repository', window.location.search);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() =>
    render(
      <TimelineControls
        context={context}
        view={context.view}
        metrics={[]}
        pending={false}
        storageAvailable
        onView={() => undefined}
        onPeriod={() => undefined}
        onReset={() => undefined}
      />,
    ),
  ).toThrow('need their family labels');
});
it('applies whatever metric ids its caller defines in the shared metrics selector', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(
    <TimelineMetricsSelector
      metrics={[
        { id: 'alpha', label: 'Alpha', unit: 'count', defaultVisible: true, selectionGroup: 'One' },
        { id: 'beta', label: 'Beta', unit: 'days', defaultVisible: false, selectionGroup: 'Two' },
      ]}
      selected={['alpha']}
      contextKey="custom"
      onApply={onApply}
    />,
  );
  await user.click(screen.getByRole('button', { name: /Metrics · 1/ }));
  await user.click(screen.getByRole('checkbox', { name: 'Beta' }));
  await user.click(screen.getByRole('button', { name: 'Apply metrics' }));
  expect(onApply).toHaveBeenCalledWith(['alpha', 'beta']);
});
function savedTimelineQuery(area: TimelineArea) {
  const raw = localStorage.getItem(
    timelinePreferenceKey('alice', makeContext(area, window.location.search)),
  );
  return raw === null ? null : (JSON.parse(raw) as { query: string }).query;
}
it('saves record filters with their kind and replaces them when another kind is saved', async () => {
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1');
  const first = renderHook(() => useControls('repository'));
  await ready(first.result);
  const filters = readRepositoryFilterValues('', 'prs')!;
  await interact(() =>
    first.result.current.changeFilters({ ...filters, authors: ['sample-alice'] }),
  );
  await ready(first.result);
  const afterFilter = new URLSearchParams(savedTimelineQuery('repository')!);
  expect(afterFilter.getAll('prs.filter.authors')).toEqual(['sample-alice']);
  expect([afterFilter.get('timeline.kind'), afterFilter.get('timeline.family')]).toEqual([
    'prs',
    'activity',
  ]);
  first.unmount();
  window.history.replaceState(
    null,
    '',
    '/repos/prebidjs?timeline=1&period=this-year&timeline.kind=issues&timeline.family=activity',
  );
  const second = renderHook(() => useControls('repository'));
  await ready(second.result);
  await interact(() =>
    second.result.current.changeView({ sort: 'issuesClosed', descending: true }),
  );
  expect(savedTimelineQuery('repository')).toBe(
    'timeline.sort=issuesClosed&timeline.dir=desc&timeline.kind=issues&timeline.family=activity',
  );
  second.unmount();
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1');
  const third = renderHook(() => useControls('repository'));
  await ready(third.result);
  expect(third.result.current.view).toMatchObject({
    kind: 'issues',
    sort: 'issuesClosed',
    descending: true,
  });
  expect(third.result.current.notice).toBeUndefined();
});
it('keeps saved columns and sort when a saved grouping cannot cover an explicit long period', async () => {
  window.history.replaceState(
    null,
    '',
    '/contributors?timeline=1&period=custom&from=2025-01-01&through=2026-10-24',
  );
  const stored =
    'timeline.group=day&timeline.columns=prsAuthored&timeline.sort=prsAuthored&timeline.dir=desc';
  localStorage.setItem(
    timelinePreferenceKey('alice', makeContext('contribution', window.location.search)),
    JSON.stringify({ version: 1, query: stored }),
  );
  const { result } = renderHook(() => useControls('contribution'));
  await ready(result);
  expect(result.current.view).toMatchObject({
    grouping: 'month',
    columns: ['prsAuthored'],
    sort: 'prsAuthored',
    descending: true,
  });
  expect(result.current.notice).toMatch(/skipped/);
  // Daily grouping still fits the default period, so it stays saved for other visits.
  expect(savedTimelineQuery('contribution')).toBe(stored);
});
it('restores a saved contribution scope when a saved Timeline column no longer exists', async () => {
  window.history.replaceState(null, '', '/contributors?timeline=1');
  const scope = defaultContributionSettings(source);
  scope.period = { kind: 'preset', preset: 'last-month' };
  const scopeKey = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(scopeKey, serializeContributionPreferences(scope));
  const scopeRaw = localStorage.getItem(scopeKey);
  localStorage.setItem(
    timelinePreferenceKey('alice', makeContext('contribution', window.location.search)),
    JSON.stringify({ version: 1, query: 'timeline.columns=retiredMetric&timeline.dir=desc' }),
  );
  const { result } = renderHook(() => useControls('contribution'));
  await ready(result);
  expect(new URLSearchParams(window.location.search).get('period')).toBe('last-month');
  expect(result.current.view.descending).toBe(true);
  expect(result.current.notice).toMatch(/skipped/);
  expect(savedTimelineQuery('contribution')).toBe('timeline.dir=desc');
  expect(localStorage.getItem(scopeKey)).toBe(scopeRaw);
});
it('drops a saved matrix repository that is no longer enabled and keeps other choices', async () => {
  window.history.replaceState(null, '', '/repos?timeline=1');
  localStorage.setItem(
    timelinePreferenceKey('alice', makeContext('matrix', window.location.search)),
    JSON.stringify({ version: 1, query: 'repo=repo-retired&timeline.dir=desc' }),
  );
  const { result } = renderHook(() => useControls('matrix'));
  await ready(result);
  expect(result.current.view.descending).toBe(true);
  expect(new URLSearchParams(window.location.search).has('repo')).toBe(false);
  expect(result.current.notice).toMatch(/skipped/);
  expect(savedTimelineQuery('matrix')).toBe('timeline.dir=desc');
});
it('repairs a saved choice that fails on every visit, but not one that fails only here', async () => {
  window.history.replaceState(null, '', '/repos?timeline=1&timeline.group=week');
  const monthSort = 'timeline.sort=month%3A2026-10-01T00%3A00%3A00.000Z';
  const key = timelinePreferenceKey('alice', makeContext('matrix', window.location.search));
  localStorage.setItem(key, JSON.stringify({ version: 1, query: monthSort }));
  const stored = localStorage.getItem(key);
  const explicitOnly = renderHook(() => useControls('matrix'));
  await ready(explicitOnly.result);
  expect(explicitOnly.result.current.notice).toMatch(/skipped/);
  expect(localStorage.getItem(key)).toBe(stored);
  explicitOnly.unmount();
  window.history.replaceState(null, '', '/repos?timeline=1');
  localStorage.setItem(
    key,
    JSON.stringify({ version: 1, query: 'timeline.group=week&' + monthSort }),
  );
  const stale = renderHook(() => useControls('matrix'));
  await ready(stale.result);
  expect(stale.result.current.notice).toMatch(/skipped/);
  expect(savedTimelineQuery('matrix')).toBe('timeline.group=week');
  stale.unmount();
  window.history.replaceState(null, '', '/repos?timeline=1');
  const repeat = renderHook(() => useControls('matrix'));
  await ready(repeat.result);
  expect(repeat.result.current.view.grouping).toBe('week');
  expect(repeat.result.current.notice).toBeUndefined();
});
