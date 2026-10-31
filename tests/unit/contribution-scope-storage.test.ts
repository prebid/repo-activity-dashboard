import { afterEach, expect, it, vi } from 'vitest';
import {
  clearContributionScope,
  discardContributionScope,
  saveContributionScope,
} from '@/lib/navigation/contribution-scope-storage';
import { contributionPreferencesChanged } from '@/lib/navigation/use-contribution-entry';
import {
  defaultContributionSettings,
  readContributionPreferenceCandidate,
  serializeContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';

const source = contributionSample(),
  key = 'scope-test';
afterEach(() => localStorage.clear());
function listen() {
  const heard = vi.fn();
  window.addEventListener(contributionPreferencesChanged, heard);
  return heard;
}
function stored(change: (settings: ReturnType<typeof defaultContributionSettings>) => void) {
  const settings = defaultContributionSettings(source);
  change(settings);
  const raw = serializeContributionPreferences(settings);
  localStorage.setItem(key, raw);
  return raw;
}
function read() {
  return readContributionPreferenceCandidate(
    localStorage.getItem(key),
    source,
    contributionSampleAsOf,
  )!;
}
it('merges one changed field into the saved scope and announces it', () => {
  stored((settings) => (settings.period = { kind: 'preset', preset: 'last-month' }));
  const heard = listen();
  const narrowed = defaultContributionSettings(source);
  narrowed.selection.repositoryIds = ['repo-prebidjs'];
  saveContributionScope(key, source, contributionSampleAsOf, narrowed, 'repositoryIds');
  expect(read().selection.repositoryIds).toEqual(['repo-prebidjs']);
  expect(read().period).toEqual({ kind: 'preset', preset: 'last-month' });
  expect(heard).toHaveBeenCalledTimes(1);
});
it('replaces a stored value that was already rejected instead of merging into it', () => {
  const save = (rejectedRaw?: string | null) =>
    saveContributionScope(
      key,
      source,
      contributionSampleAsOf,
      defaultContributionSettings(source),
      'period',
      rejectedRaw,
    );
  const rejected = stored(
    (settings) => (settings.selection.excludedAccountIds = ['account-alice']),
  );
  save(rejected);
  expect(read().selection.excludedAccountIds).toEqual([]);
  stored((settings) => (settings.selection.excludedAccountIds = ['account-alice']));
  save();
  expect(read().selection.excludedAccountIds).toEqual(['account-alice']);
  // A rejection of an older value does not discard a newer saved value.
  stored((settings) => {
    settings.selection.excludedAccountIds = ['account-alice'];
    settings.period = { kind: 'preset', preset: 'last-month' };
  });
  saveContributionScope(
    key,
    source,
    contributionSampleAsOf,
    defaultContributionSettings(source),
    'repositoryIds',
    rejected,
  );
  expect(read().selection.excludedAccountIds).toEqual(['account-alice']);
  expect(read().period).toEqual({ kind: 'preset', preset: 'last-month' });
  localStorage.setItem(key, 'unreadable');
  save('unreadable');
  expect(read().selection.excludedAccountIds).toEqual([]);
});
it('removes only the checked saved value and announces each removal', () => {
  const heard = listen();
  localStorage.setItem(key, 'newer');
  expect(discardContributionScope(key, 'older')).toBe(false);
  expect(localStorage.getItem(key)).toBe('newer');
  expect(discardContributionScope(key, 'newer')).toBe(true);
  expect(localStorage.getItem(key)).toBeNull();
  expect(discardContributionScope(key, null)).toBe(true);
  localStorage.setItem(key, 'any');
  clearContributionScope(key);
  expect(localStorage.getItem(key)).toBeNull();
  expect(heard).toHaveBeenCalledTimes(2);
});
