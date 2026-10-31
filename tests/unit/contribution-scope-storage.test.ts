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
it('merges one changed field into the saved scope and announces it', () => {
  const heard = listen();
  const narrowed = defaultContributionSettings(source);
  narrowed.selection.repositoryIds = ['repo-prebidjs'];
  saveContributionScope(key, source, contributionSampleAsOf, narrowed, 'repositoryIds');
  expect(
    readContributionPreferenceCandidate(localStorage.getItem(key), source, contributionSampleAsOf)
      ?.selection.repositoryIds,
  ).toEqual(['repo-prebidjs']);
  expect(heard).toHaveBeenCalledTimes(1);
});
it('replaces a stored value that was already rejected instead of merging into it', () => {
  localStorage.setItem(key, 'rejected');
  saveContributionScope(
    key,
    source,
    contributionSampleAsOf,
    defaultContributionSettings(source),
    'period',
    'rejected',
  );
  expect(
    readContributionPreferenceCandidate(localStorage.getItem(key), source, contributionSampleAsOf),
  ).not.toBeNull();
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
