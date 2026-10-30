import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  useContributionEntry,
  contributionPreferencesChanged,
} from '@/lib/navigation/use-contribution-entry';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  serializeContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import { contributionSample } from '@/mocks/contributions';
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
const settings = defaultContributionSettings(contributionSample());
it('renders an ordinary server link and resolves saved scope before client navigation', () => {
  function Entry() {
    return <a href={useContributionEntry('alice')}>Contributions</a>;
  }
  const saved = { ...settings, period: { kind: 'preset' as const, preset: 'last-month' as const } };
  const key = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(key, serializeContributionPreferences(saved));
  expect(renderToString(<Entry />)).toContain('href="/contributors"');
  const { result, rerender, unmount } = renderHook<string, { viewer: string | undefined }>(
    ({ viewer }: { viewer: string | undefined }) => useContributionEntry(viewer),
    {
      initialProps: { viewer: 'alice' },
    },
  );
  expect(new URL(result.current, 'https://dashboard.test').searchParams.get('period')).toBe(
    'last-month',
  );
  act(() => {
    localStorage.setItem(
      key,
      serializeContributionPreferences({
        ...saved,
        selection: { ...saved.selection, actorTypes: ['bot'] },
      }),
    );
    window.dispatchEvent(new Event(contributionPreferencesChanged));
  });
  expect(new URL(result.current, 'https://dashboard.test').searchParams.getAll('type')).toEqual([
    'bot',
  ]);
  act(() => {
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent('storage'));
  });
  expect(result.current).toBe('/contributors');
  rerender({ viewer: 'bob' });
  expect(result.current).toBe('/contributors');
  rerender({ viewer: undefined });
  expect(result.current).toBe('/contributors');
  unmount();
});
it('uses a safe entry when browser preferences are malformed, oversized or inaccessible', () => {
  const key = contributionPreferenceKey('alice', 'reference');
  localStorage.setItem(key, '{invalid');
  const { result } = renderHook(() => useContributionEntry('alice'));
  expect(result.current).toBe('/contributors');
  act(() => {
    localStorage.setItem(
      key,
      serializeContributionPreferences({
        ...settings,
        selection: {
          ...settings.selection,
          population: {
            kind: 'selected',
            companyIds: [],
            accountIds: Array.from({ length: 1000 }, (_, i) => 'account-' + i),
          },
        },
      }),
    );
    window.dispatchEvent(new StorageEvent('storage'));
  });
  expect(result.current).toBe('/contributors');
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('blocked');
  });
  act(() => {
    window.dispatchEvent(new StorageEvent('storage'));
  });
  expect(result.current).toBe('/contributors');
  read.mockRestore();
});
