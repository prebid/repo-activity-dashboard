import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';
import { useEntryHref } from '@/lib/navigation/use-entry-href';
import { PreferenceBindingProvider } from '@/lib/navigation/preference-binding';
import { preferenceChangeEvent } from '@/lib/navigation/use-preference-cookie';
import type { SavedViewValues } from '@/lib/presentation/url/entry';
import type { PreferenceBinding, PreferenceSectionKey } from '@/models/preferences';
import { alice, seedPreferences } from '../support/preference-cookies';

function session(binding: PreferenceBinding | null) {
  return function Session({ children }: { children: ReactNode }) {
    return binding ? (
      <PreferenceBindingProvider binding={binding}>{children}</PreferenceBindingProvider>
    ) : (
      children
    );
  };
}
/** The Summary's saved repositories: a test stand-in for the area's section reader. */
const savedRepositories = (read: (section: PreferenceSectionKey) => string | null) => {
  const raw = read('overview');
  if (raw === null) return null;
  const value = JSON.parse(raw) as { repo?: string[]; custom?: boolean };
  return value.custom ? null : ({ scope: { repo: value.repo ?? [] } } satisfies SavedViewValues);
};
afterEach(() => {
  document.cookie = 'dashboard-repositories=; Max-Age=0; Path=/';
});

it('renders the bare entry on the server and the saved explicit form after hydration', () => {
  seedPreferences(alice, { overview: { repo: ['prebidjs'] } });
  function Probe() {
    return <>{useEntryHref('/repos', savedRepositories, { viewerId: 'alice' })}</>;
  }
  expect(
    renderToString(
      <PreferenceBindingProvider binding={alice}>
        <Probe />
      </PreferenceBindingProvider>,
    ),
  ).toBe('/repos');
  const { result } = renderHook(
    () => useEntryHref('/repos', savedRepositories, { viewerId: 'alice' }),
    { wrapper: session(alice) },
  );
  expect(result.current).toBe('/repos?repo=prebidjs');
  seedPreferences(alice, { overview: { repo: ['prebidserver'] } });
  act(() => {
    window.dispatchEvent(new Event(preferenceChangeEvent));
  });
  expect(result.current).toBe('/repos?repo=prebidserver');
});

it('stays bare without a session, for another account, or when the server must validate', () => {
  seedPreferences(alice, { overview: { repo: ['prebidjs'] } });
  const bare = (binding: PreferenceBinding | null, viewerId?: string) =>
    renderHook(() => useEntryHref('/repos', savedRepositories, { viewerId }), {
      wrapper: session(binding),
    }).result.current;
  expect(bare(null)).toBe('/repos');
  expect(bare(alice, 'bob')).toBe('/repos');
  seedPreferences(alice, { overview: { custom: true } });
  expect(bare(alice)).toBe('/repos');
  // A section the cookie cannot read reads as absent.
  const { result } = renderHook(
    () =>
      useEntryHref(
        '/repos',
        (read) => (read('unknown' as PreferenceSectionKey) === null ? null : { scope: {} }),
        { selectors: { timeline: true } },
      ),
    { wrapper: session(alice) },
  );
  expect(result.current).toBe('/repos?timeline');
});

it('keeps selectors and segments, and drops a saved view too large for a link', () => {
  seedPreferences(alice, { overview: { repo: ['prebidjs'] } });
  const { result } = renderHook(
    () =>
      useEntryHref(
        '/repos/[slug]',
        (read) => (read('overview') ? { presentation: { sort: 'number' } } : null),
        { segments: { slug: ['prebidjs'] }, selectors: { view: 'issues' } },
      ),
    { wrapper: session(alice) },
  );
  expect(result.current).toBe('/repos/prebidjs?view=issues&sort=number');
  const large = renderHook(
    () => useEntryHref('/repos', () => ({ presentation: { bsort: 'x'.repeat(7600) } })),
    { wrapper: session(alice) },
  );
  expect(large.result.current).toBe('/repos');
});
