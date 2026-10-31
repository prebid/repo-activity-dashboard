import { useMemo, useSyncExternalStore } from 'react';
import { act as reactAct, renderHook, waitFor, render, screen } from '@testing-library/react';
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
  await interact(() => result.current.table.setSearch('ignored'));
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
  expect(second.result.current.notice).toContain('do not fit');
  second.unmount();
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
  await user.click(screen.getByRole('button', { name: 'Custom range for Timeline period' }));
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
