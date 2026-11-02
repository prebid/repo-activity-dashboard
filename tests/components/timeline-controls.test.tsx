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
import {
  readTimelineView,
  resolveTimelineEntry,
  timelineEntryNotices,
  timelinePreferenceKey,
} from '@/lib/presentation/timeline-controls';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { readContributionSettings } from '@/lib/presentation/contribution-settings';
import { readRepositoryFilterValues } from '@/lib/presentation/repository-page-query';
import type { TimelineArea, TimelineControlContext } from '@/models/timeline-controls';
import type { PreferenceSectionKey } from '@/models/preferences';
import { TimelineControls } from '@/components/reporting/timeline-controls';
import { TimelineMetricsSelector } from '@/components/reporting/timeline-metrics-selector';
import {
  alice,
  preferenceSections,
  rawPreferenceCookie,
  savedSection,
  seedPreferences,
} from '../support/preference-cookies';
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
const sections: Record<TimelineArea, PreferenceSectionKey> = {
  matrix: 'timeline.matrix',
  repository: 'timeline.repository',
  contribution: 'timeline.contributors.overview',
};
/** The context route composition builds; `viewer` adds the cookie sections it hands the hook. */
function makeContext(
  area: TimelineArea,
  search: string,
  viewer?: string,
  notice?: string,
): TimelineControlContext {
  const parsed = readTimelineView(new URLSearchParams(search), area, asOf);
  const path =
    area === 'contribution'
      ? '/contributors'
      : area === 'repository'
        ? '/repos/prebidjs'
        : '/repos';
  const binding = { accountId: viewer ?? '', authVersion: 0 };
  return {
    area,
    path,
    href: path + '?' + new URLSearchParams(search).toString(),
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
    ...(viewer !== undefined && {
      preferences: {
        presentation: savedSection(sections[area], null, undefined, binding),
        ...(area === 'contribution' && {
          scope: savedSection('contributions.scope', null, undefined, binding),
        }),
        ...(notice !== undefined && { notice }),
      },
    }),
  };
}
function useControls(area: TimelineArea = 'matrix', viewer = 'alice') {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  const context = useMemo(() => makeContext(area, search, viewer), [area, search, viewer]);
  return {
    ...useTimelineControls(viewer, context, { prsOpened: true, prsAuthored: true }),
    context,
  };
}
const historyWrites = vi.fn();
beforeEach(() => {
  window.history.replaceState(null, '', '/repos?timeline=1');
  historyWrites.mockClear();
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation(
      (state: unknown, unused: string, url?: string | URL | null) => {
        historyWrites(method, url);
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
/** The saved Timeline query in the live cookie, or null when the section is absent. */
function savedTimelineQuery(area: TimelineArea) {
  const value = preferenceSections(area === 'contribution' ? 'contributions' : 'repositories')?.[
    sections[area]
  ] as { query: string } | undefined;
  return value ? value.query : null;
}
/** A cookie jar that keeps nothing, as when the browser blocks cookies. */
function blockCookies() {
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
}

it.each([
  ['matrix', '/repos'],
  ['repository', '/repos/prebidjs'],
  ['contribution', '/contributors'],
] as const)(
  'renders the server-resolved %s view on its first render without rewriting history',
  async (area, path) => {
    // The address the server redirected an entry to, with a saved descending order applied.
    const entry = resolveTimelineEntry('timeline=1', makeContext(area, 'timeline=1'), {
      presentation: 'timeline.dir=desc',
    });
    if (entry.kind !== 'redirect') throw Error('Expected a redirect');
    window.history.replaceState(null, '', path + '?' + entry.search);
    historyWrites.mockClear();
    const views: boolean[] = [];
    const { result } = renderHook(() => {
      const controls = useControls(area);
      views.push(controls.view.descending, controls.pending);
      return controls;
    });
    expect(views.slice(0, 2)).toEqual([true, false]);
    await ready(result);
    expect(historyWrites).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(rawPreferenceCookie(area === 'contribution' ? 'contributions' : 'repositories')).toBe(
      undefined,
    );
  },
);
it('shows the entry notice, deletes the rejected section after hydration and clears the notice on an edit', async () => {
  seedPreferences(alice, { 'timeline.matrix': { version: 9 }, overview: 'kept' });
  const context = makeContext('matrix', 'timeline=1', 'alice', timelineEntryNotices.invalid);
  context.preferences!.presentation = savedSection('timeline.matrix', null, '{"version":9}');
  historyWrites.mockClear();
  const { result } = renderHook(() => useTimelineControls('alice', context, {}));
  expect(result.current.notice).toBe(timelineEntryNotices.invalid);
  expect(preferenceSections('repositories')).toEqual({ overview: 'kept' });
  expect(historyWrites).not.toHaveBeenCalled();
  await interact(() => result.current.changeView({ chart: true }));
  expect(result.current.notice).toBeUndefined();
});
it('copies a legacy localStorage Timeline preference once without changing this render', async () => {
  const key = timelinePreferenceKey('alice', makeContext('matrix', 'timeline=1'));
  localStorage.setItem(key, JSON.stringify({ version: 1, query: 'timeline.group=week' }));
  const { result } = renderHook(() => useControls());
  await ready(result);
  expect(result.current.view.grouping).toBe('month');
  expect(savedTimelineQuery('matrix')).toBe('timeline.group=week');
  expect(localStorage.getItem(key)).toBeNull();
});
it('saves deliberate presentation fields, never row or window pages, and freezes Back state', async () => {
  window.history.replaceState(
    null,
    '',
    '/repos?timeline=1&timeline.state=1&period=this-year&timeline.group=day',
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
  expect(savedTimelineQuery('matrix')).toBeNull();
  await interact(() => result.current.table.reconcilePage(1));
  await ready(result);
  expect(result.current.view.page).toBe(1);
  await interact(() => result.current.changeView({ grouping: 'week' }));
  await ready(result);
  expect(result.current.view.window).toBe(4);
  expect(result.current.view.page).toBe(1);
  expect(savedTimelineQuery('matrix')).toBe(
    'timeline.group=week&timeline.sort=repository&timeline.dir=asc',
  );
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
it('honors explicit state, writes only for its own session and rejects oversized edits without storing or moving', async () => {
  seedPreferences(alice, { 'timeline.matrix': { version: 1, query: 'timeline.group=week' } });
  window.history.replaceState(null, '', '/repos?timeline=1&timeline.state=1&timeline.group=day');
  const { result, rerender } = renderHook(({ viewer }) => useControls('matrix', viewer), {
    initialProps: { viewer: 'alice' },
  });
  await ready(result);
  expect(result.current.view.grouping).toBe('day');
  const url = window.location.href,
    raw = rawPreferenceCookie('repositories');
  await interact(() =>
    expect(
      result.current.changePeriod({ kind: 'custom', from: '2020-01-01', through: '2026-10-24' }),
    ).toContain('500'),
  );
  expect(window.location.href).toBe(url);
  expect(rawPreferenceCookie('repositories')).toBe(raw);
  await interact(() => result.current.changeRepositories(['unknown']));
  expect(result.current.notice).toContain('no longer available');
  await interact(() => result.current.changeRepositories([]));
  await ready(result);
  expect(new URLSearchParams(window.location.search).get('repo')).toBe('');
  await interact(() => result.current.changePeriod({ kind: 'preset', preset: 'last-week' }));
  await ready(result);
  expect(result.current.context.period).toEqual({ kind: 'preset', preset: 'last-week' });
  expect(new URLSearchParams(savedTimelineQuery('matrix')!).get('period')).toBe('last-week');
  const saved = rawPreferenceCookie('repositories');
  rerender({ viewer: 'bob' });
  await ready(result);
  // Rendering for another account reads and writes nothing.
  expect(rawPreferenceCookie('repositories')).toBe(saved);
  await interact(() => result.current.reset());
  await ready(result);
  expect(result.current.view.grouping).toBe('month');
  expect(preferenceSections('repositories', { accountId: 'bob', authVersion: 0 })).toBeNull();
});
it('keeps working when the browser keeps no cookie', async () => {
  blockCookies();
  const { result } = renderHook(() => useControls());
  await ready(result);
  expect(result.current.storageAvailable).toBe(true);
  await interact(() => result.current.changeView({ grouping: 'week' }));
  await ready(result);
  expect(result.current.view.grouping).toBe('week');
  expect(result.current.storageAvailable).toBe(false);
  await interact(() => result.current.reset());
  await ready(result);
  expect(result.current.view.grouping).toBe('month');
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
it('saves an Over time scope change into the shared scope section and deletes it on reset', async () => {
  window.history.replaceState(null, '', '/contributors?timeline=1&type=agent&report.q=Alice');
  const { result } = renderHook(() => useControls('contribution'));
  await ready(result);
  expect(result.current.context.contribution!.selection.actorTypes).toEqual(['agent']);
  const next = {
    ...result.current.context.contribution!,
    period: { kind: 'preset' as const, preset: 'last-month' as const },
  };
  await interact(() => result.current.changeContribution(next, 'period'));
  await ready(result);
  const scope = preferenceSections('contributions')!['contributions.scope'] as {
    version: number;
    settings: { period: unknown; selection: { actorTypes: string[] } };
  };
  // Only the changed field is saved; the explicit account types stay in the link.
  expect(scope.version).toBe(1);
  expect(scope.settings.period).toEqual({ kind: 'preset', preset: 'last-month' });
  expect(scope.settings.selection.actorTypes).toEqual(
    readContributionSettings(new URLSearchParams(''), source, asOf)!.selection.actorTypes,
  );
  expect(savedTimelineQuery('contribution')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('report.q')).toBe('Alice');
  await interact(() => result.current.resetContribution());
  await ready(result);
  expect(preferenceSections('contributions')).toBeNull();
});
it('retains rejected custom-date drafts in the shared Timeline controls', async () => {
  const user = userEvent.setup(),
    context = makeContext('matrix', 'timeline=1');
  render(
    <TimelineControls
      context={context}
      view={context.view}
      metrics={[]}
      onView={() => {}}
      onPeriod={() => 'Choose fewer than 501 intervals.'}
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
  const saved = savedTimelineQuery('matrix')!;
  expect(saved).toContain('timeline.sort=repository');
  expect(saved).not.toContain('month%3A');
});
it('rejects rapid edits until the current edit has been accepted', async () => {
  window.history.replaceState(null, '', '/repos?timeline=1');
  const { result } = renderHook(() => useControls());
  await ready(result);
  let rejected: string | undefined;
  await interact(() => {
    result.current.changeView({ grouping: 'week' });
    rejected = result.current.changeView({ grouping: 'day' });
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
  expect(rawPreferenceCookie('contributions')).toBeUndefined();
  blockCookies();
  await interact(() =>
    first.result.current.changeContribution(
      { ...settings, period: { kind: 'preset', preset: 'last-month' } },
      'period',
    ),
  );
  await ready(first.result);
  expect(first.result.current.storageAvailable).toBe(false);
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
it('reconciles a page past the last one in memory, without a history write', async () => {
  window.history.replaceState(null, '', '/repos?timeline=1&timeline.state=1&timeline.page=9');
  const { result } = renderHook(() => useControls());
  await ready(result);
  const requested = window.location.href;
  historyWrites.mockClear();
  await interact(() => result.current.table.reconcilePage(2));
  expect(result.current.view.page).toBe(2);
  expect(result.current.table.query.page).toBe(2);
  expect(new URLSearchParams(result.current.href.split('?')[1]).get('timeline.page')).toBe('2');
  expect(window.location.href).toBe(requested);
  expect(historyWrites).not.toHaveBeenCalled();
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
  expect(rawPreferenceCookie('repositories')).toBeUndefined();
});
it('saves the record kind with kind-specific choices so another kind ignores them', async () => {
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1');
  const { result } = renderHook(() => useControls('repository'));
  await ready(result);
  await interact(() => result.current.changeView({ metric: 'medianMergeDays' }));
  const saved = new URLSearchParams(savedTimelineQuery('repository')!);
  expect([
    saved.get('timeline.metric'),
    saved.get('timeline.kind'),
    saved.get('timeline.family'),
  ]).toEqual(['medianMergeDays', 'prs', 'activity']);
});
it.each([
  '/repos/prebidjs?timeline=1&timeline.state=1&period=this-year&timeline.group=month',
  '/repos/prebidjs?timeline=1',
])('renders %s without a loading gate on the first render', (url) => {
  window.history.replaceState(null, '', url);
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
      onView={() => undefined}
      onPeriod={() => undefined}
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
        onView={() => undefined}
        onPeriod={() => undefined}
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
  // The next entry resolves on the server to the saved kind and order.
  const entry = resolveTimelineEntry('timeline=1', makeContext('repository', 'timeline=1'), {
    presentation: savedTimelineQuery('repository'),
  });
  if (entry.kind !== 'redirect') throw Error('Expected a redirect');
  const next = readTimelineView(new URLSearchParams(entry.search), 'repository', asOf).view;
  expect(next).toMatchObject({ kind: 'issues', sort: 'issuesClosed', descending: true });
});
