import Link from 'next/link';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HistoryEntryMarker,
  followHref,
  historyMarkerKey,
  markHistoryEntry,
  pinCurrentEntry,
  previousEntry,
  replaceHash,
  shouldGoBack,
  useUrlState,
  writeHistory,
} from '@/lib/navigation/use-url-state';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (notify: () => void) => {
    window.addEventListener('test-navigation', notify);
    window.addEventListener('popstate', notify);
    return () => {
      window.removeEventListener('test-navigation', notify);
      window.removeEventListener('popstate', notify);
    };
  };
  return {
    useRouter: () => router,
    usePathname: () =>
      useSyncExternalStore(
        subscribe,
        () => window.location.pathname,
        () => '/',
      ),
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          subscribe,
          () => window.location.search,
          () => '',
        ),
      ),
  };
});
/** Next's own entries carry `__NA`; its push starts a fresh state without custom keys. */
function nextPush(href: string) {
  window.history.pushState({ __NA: true }, '', href);
  window.dispatchEvent(new Event('test-navigation'));
}
const address = () => window.location.pathname + window.location.search + window.location.hash;
beforeEach(() => {
  window.history.replaceState({ __NA: true }, '', '/');
  // Settle the module's record of the committed address.
  markHistoryEntry();
});
afterEach(() => {
  router.push.mockReset();
});

describe('history writes', () => {
  it('records the address a push leaves and keeps the fragment', () => {
    window.history.replaceState(null, '', '/repos?age=#period-activity');
    writeHistory('push', '/repos?age=30,60');
    expect(address()).toBe('/repos?age=30,60#period-activity');
    expect(window.history.state).toEqual({ [historyMarkerKey]: '/repos?age=' });
    writeHistory('replace', '/repos?age=60#backlog');
    expect(address()).toBe('/repos?age=60#backlog');
    expect(previousEntry()).toBe('/repos?age=');
  });

  it('replaces only the fragment and keeps the entry state', () => {
    window.history.replaceState({ [historyMarkerKey]: '/repos', kept: 1 }, '', '/repos/prebidjs');
    replaceHash('period-activity');
    expect(address()).toBe('/repos/prebidjs#period-activity');
    expect(window.history.state).toEqual({ [historyMarkerKey]: '/repos', kept: 1 });
  });

  it('pins a rendered bare entry before leaving it, and nothing else', () => {
    for (const [from, to] of [
      ['/repos', '/repos?v=1'],
      ['/repos?timeline', '/repos?timeline&v=1'],
      ['/repos/prebidjs?view=issues&back=-', '/repos/prebidjs?view=issues&back=-&v=1'],
    ]) {
      window.history.replaceState(null, '', from);
      expect(pinCurrentEntry()).toBe(true);
      expect(address()).toBe(to);
    }
    for (const unchanged of ['/repos?age=', '/repos?v=1', '/repos?timeline=1', '/foundation']) {
      window.history.replaceState(null, '', unchanged);
      expect(pinCurrentEntry()).toBe(false);
      expect(address()).toBe(unchanged);
    }
  });

  it('marks a Next push with the address it left, once, and never on load', async () => {
    // A page load starts the module with nothing committed.
    vi.resetModules();
    const fresh = await import('@/lib/navigation/use-url-state');
    window.history.replaceState({ __NA: true }, '', '/repos?age=');
    fresh.markHistoryEntry();
    expect(window.history.state).toEqual({ __NA: true });
    nextPush('/repos/prebidjs');
    fresh.markHistoryEntry();
    expect(window.history.state).toEqual({ __NA: true, [historyMarkerKey]: '/repos?age=' });
    // An entry that already records its origin keeps it.
    window.history.replaceState({ __NA: true, [historyMarkerKey]: '/elsewhere' }, '', '/x');
    fresh.markHistoryEntry();
    expect(fresh.previousEntry()).toBe('/elsewhere');
    // The same address again records nothing.
    window.history.replaceState(null, '', '/x');
    fresh.markHistoryEntry();
    expect(window.history.state).toBeNull();
  });

  it('starts a server navigation from the pinned entry and records it as the origin', () => {
    window.history.replaceState({ __NA: true }, '', '/contributors');
    markHistoryEntry();
    followHref(router, '/contributors/account-alice');
    expect(address()).toBe('/contributors?v=1');
    expect(router.push).toHaveBeenCalledWith('/contributors/account-alice');
    nextPush('/contributors/account-alice');
    markHistoryEntry();
    expect(previousEntry()).toBe('/contributors?v=1');
  });

  it('goes back only to the view the entry came from', () => {
    expect(shouldGoBack('/repos?v=1', '/repos')).toBe(true);
    expect(shouldGoBack('/repos?age=', '/repos')).toBe(false);
    expect(shouldGoBack(undefined, '/repos')).toBe(false);
    expect(shouldGoBack(3, '/repos')).toBe(false);
  });
});

describe('HistoryEntryMarker', () => {
  it('pins a bare entry when a same-tab link leaves it, and follows Back/Forward', () => {
    window.history.replaceState({ __NA: true }, '', '/repos');
    const view = render(
      <>
        <HistoryEntryMarker />
        <Link href="/repos/prebidjs">Prebid.js</Link>
        <Link href="/repos/prebidjs" target="_blank">
          New tab
        </Link>
        <a href="https://example.test/">Elsewhere</a>
        <a href="/file.csv" download>
          Export
        </a>
      </>,
    );
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('click', prevent);
    for (const name of ['New tab', 'Elsewhere', 'Export']) {
      fireEvent.click(view.getByText(name));
      expect(address()).toBe('/repos');
    }
    fireEvent.click(view.getByText('Prebid.js'), { ctrlKey: true });
    expect(address()).toBe('/repos');
    fireEvent.click(view.getByText('Prebid.js'));
    expect(address()).toBe('/repos?v=1');
    document.removeEventListener('click', prevent);
    act(() => nextPush('/repos/prebidjs'));
    expect(previousEntry()).toBe('/repos?v=1');
    act(() => {
      window.history.replaceState({ __NA: true }, '', '/repos?v=1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    // A traversal is not a new entry: nothing is recorded on it.
    expect(window.history.state).toEqual({ __NA: true });
    view.unmount();
  });
});

describe('useUrlState', () => {
  it('reads canonical values and writes the next view with rebased frames', () => {
    window.history.replaceState(null, '', '/repos?timeline&repo=prebidjs#matrix');
    const { result } = renderHook(() => useUrlState('/repos'));
    expect(result.current.values).toEqual({ timeline: true, repo: ['prebidjs'] });
    expect(result.current.entry).toBe(false);
    act(() => {
      expect(result.current.push({ timeline: true, repo: ['prebidserver'] })).toBe(true);
      window.dispatchEvent(new Event('test-navigation'));
    });
    // The Summary derived from the earlier repository choice stays the parent.
    expect(address()).toBe('/repos?timeline&repo=prebidserver&back=~repo:prebidjs#matrix');
    expect(previousEntry()).toBe('/repos?timeline&repo=prebidjs');
    act(() => {
      expect(
        result.current.replace({
          timeline: true,
          repo: ['prebidserver'],
          group: 'week',
          back: ['~repo:prebidjs'],
        }),
      ).toBe(true);
    });
    expect(address()).toBe(
      '/repos?timeline&repo=prebidserver&group=week&back=~repo:prebidjs#matrix',
    );
    // A write that does not change the address writes nothing.
    const spy = vi.spyOn(window.history, 'replaceState');
    result.current.replace({
      timeline: true,
      repo: ['prebidserver'],
      group: 'week',
      back: ['~repo:prebidjs'],
    });
    expect(spy).not.toHaveBeenCalled();
    result.current.navigate('/repos?timeline&repo=prebidjs');
    expect(router.push).toHaveBeenCalledWith('/repos?timeline&repo=prebidjs');
    result.current.replaceHash('top');
    expect(window.location.hash).toBe('#top');
  });

  it('pins a bare entry before its first push and refuses a view beyond the cap', () => {
    window.history.replaceState(null, '', '/repos');
    const { result } = renderHook(() => useUrlState('/repos'));
    expect(result.current.entry).toBe(true);
    const spy = vi.spyOn(window.history, 'replaceState');
    act(() => {
      expect(result.current.push({ age: [] })).toBe(true);
    });
    expect(spy).toHaveBeenCalledWith(expect.anything(), '', '/repos?v=1');
    expect(address()).toBe('/repos?age=');
    expect(result.current.push({ bsort: 'x'.repeat(7600) })).toBe(false);
    expect(result.current.href({ age: ['60'] })).toBe('/repos?age=60');
  });

  it('has no values on a legacy or another route’s address', () => {
    window.history.replaceState(null, '', '/repos?timeline=1');
    const legacy = renderHook(() => useUrlState('/repos'));
    expect(legacy.result.current.values).toBeNull();
    expect(legacy.result.current.entry).toBe(false);
    expect(legacy.result.current.push({})).toBe(false);
    window.history.replaceState(null, '', '/contributors');
    const other = renderHook(() => useUrlState('/repos'));
    expect(other.result.current.values).toBeNull();
    expect(other.result.current.href({})).toBeNull();
  });
});
