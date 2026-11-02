import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';
import { useSavedTimelinePresentation } from '@/lib/navigation/use-saved-timeline';
import { PreferenceBindingProvider } from '@/lib/navigation/preference-binding';
import { preferenceChangeEvent } from '@/lib/navigation/use-preference-cookie';
import { alice, seedPreferences } from '../support/preference-cookies';

function session({ children }: { children: ReactNode }) {
  return <PreferenceBindingProvider binding={alice}>{children}</PreferenceBindingProvider>;
}
const saved = (query: string) => ({ 'timeline.repository': { version: 1, query } });
afterEach(() => {
  for (const cookie of document.cookie.split('; '))
    document.cookie = cookie.split('=')[0] + '=; Max-Age=0; Path=/';
});

it('reads the saved Timeline presentation after hydration and follows later saves', () => {
  seedPreferences(alice, saved('timeline.chart=1'));
  function Probe() {
    return <>{useSavedTimelinePresentation('timeline.repository', 'repository') ?? 'none'}</>;
  }
  expect(
    renderToString(
      <PreferenceBindingProvider binding={alice}>
        <Probe />
      </PreferenceBindingProvider>,
    ),
  ).toBe('none');
  const { result } = renderHook(
    () => useSavedTimelinePresentation('timeline.repository', 'repository'),
    { wrapper: session },
  );
  expect(result.current).toBe('timeline.chart=1');
  seedPreferences(alice, saved('timeline.chart=1&timeline.metric=medianMergeDays'));
  act(() => {
    window.dispatchEvent(new Event(preferenceChangeEvent));
  });
  expect(result.current).toBe('timeline.chart=1&timeline.metric=medianMergeDays');
});

it('reads nothing without a session, a saved section, or a readable one', () => {
  const read = (wrapper?: typeof session) =>
    renderHook(() => useSavedTimelinePresentation('timeline.repository', 'repository'), {
      wrapper,
    }).result.current;
  seedPreferences(alice, saved('timeline.chart=1'));
  expect(read()).toBeNull();
  seedPreferences(alice, { overview: { repo: ['prebidjs'] } });
  expect(read(session)).toBeNull();
  // A field the repository Timeline never saves makes the section unreadable.
  seedPreferences(alice, saved('timeline.chart=1&group=week'));
  expect(read(session)).toBeNull();
});
