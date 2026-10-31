import { afterEach, expect, it, vi } from 'vitest';
import {
  clearContributionScope,
  discardContributionScope,
  lookupSavedScope,
  saveContributionScope,
  savedScopeLookupTimeoutMs,
  savedScopeNotices,
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
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});
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
it('looks up a saved scope only when it names accounts or companies', async () => {
  const validate = vi.fn(() => Promise.resolve(null));
  const plain = defaultContributionSettings(source);
  await expect(lookupSavedScope({ validate }, plain, new AbortController().signal)).resolves.toBe(
    plain,
  );
  expect(validate).not.toHaveBeenCalled();
  const named = defaultContributionSettings(source);
  named.selection.excludedAccountIds = ['account-alice'];
  await expect(
    lookupSavedScope({ validate }, named, new AbortController().signal),
  ).resolves.toBeNull();
  expect(validate).toHaveBeenCalledTimes(1);
});
it('abandons a stalled lookup at the timeout and when its caller aborts', async () => {
  vi.useFakeTimers();
  const named = defaultContributionSettings(source);
  named.selection.excludedAccountIds = ['account-alice'];
  const signals: AbortSignal[] = [];
  const validate = vi.fn((_: unknown, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<null>(() => {});
  });
  const stalled = lookupSavedScope({ validate }, named, new AbortController().signal);
  vi.advanceTimersByTime(savedScopeLookupTimeoutMs);
  await expect(stalled).rejects.toThrow(savedScopeNotices.unchecked);
  expect(signals[0].aborted).toBe(true);
  const caller = new AbortController();
  void lookupSavedScope({ validate }, named, caller.signal).catch(() => {});
  caller.abort();
  expect(signals[1].aborted).toBe(true);
});
