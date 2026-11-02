import { expect, it } from 'vitest';
import {
  legacyContributionScope,
  mergedContributionScope,
} from '@/lib/navigation/contribution-scope-storage';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  serializeContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import type { ContributionSettings } from '@/models/contribution-settings';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { alice, savedSection, seedPreferences } from '../support/preference-cookies';

const source = contributionSample();
const section = 'contributions.scope' as const;
/** A scope as the readers normalise it, with repository IDs in sorted order. */
function settings(change: (value: ContributionSettings) => void = () => {}) {
  const value = defaultContributionSettings(source);
  value.selection.repositoryIds.sort();
  change(value);
  return value;
}
const stored = (value: ContributionSettings): unknown =>
  JSON.parse(serializeContributionPreferences(value));
/** The merged value with repository IDs sorted, since the defaults keep catalog order. */
function merge(next: ContributionSettings, field: 'period' | 'repositoryIds', invalid?: string) {
  const value = mergedContributionScope(
    savedSection(section, null, invalid),
    source,
    contributionSampleAsOf,
    next,
    field,
  ) as { settings: ContributionSettings };
  value.settings.selection.repositoryIds.sort();
  return value;
}

it('merges one changed field into the scope the cookie holds now', () => {
  seedPreferences(alice, {
    [section]: stored(
      settings((value) => (value.period = { kind: 'preset', preset: 'last-month' })),
    ),
  });
  const narrowed = settings((value) => (value.selection.repositoryIds = ['repo-prebidjs']));
  expect(merge(narrowed, 'repositoryIds')).toEqual(
    stored(
      settings((value) => {
        value.period = { kind: 'preset', preset: 'last-month' };
        value.selection.repositoryIds = ['repo-prebidjs'];
      }),
    ),
  );
});

it('starts from the defaults when nothing is saved or the cookie belongs to another session', () => {
  const lastMonth = settings((value) => (value.period = { kind: 'preset', preset: 'last-month' }));
  expect(merge(lastMonth, 'period')).toEqual(stored(lastMonth));
  seedPreferences(
    { ...alice, authVersion: 1 },
    { [section]: stored(settings((value) => (value.selection.actorTypes = ['bot']))) },
  );
  expect(merge(lastMonth, 'period')).toEqual(stored(lastMonth));
});

it('replaces a value the server rejected instead of merging into it', () => {
  const rejected = stored(
    settings((value) => (value.selection.excludedAccountIds = ['account-removed'])),
  );
  seedPreferences(alice, { [section]: rejected });
  const lastMonth = settings((value) => (value.period = { kind: 'preset', preset: 'last-month' }));
  expect(merge(lastMonth, 'period', JSON.stringify(rejected))).toEqual(stored(lastMonth));
  // A newer value than the rejected one is merged into as usual.
  expect(merge(lastMonth, 'period', '{"stale":true}')).toEqual(
    stored(
      settings((value) => {
        value.period = { kind: 'preset', preset: 'last-month' };
        value.selection.excludedAccountIds = ['account-removed'];
      }),
    ),
  );
});

it('reads a legacy localStorage scope through the existing reader for the one-time copy', () => {
  const legacy = legacyContributionScope('alice', 'large', source, contributionSampleAsOf);
  expect(legacy.keys).toEqual([contributionPreferenceKey('alice', 'large')]);
  const saved = settings((value) => (value.selection.actorTypes = ['bot', 'human']));
  expect(legacy.read(serializeContributionPreferences(saved))).toEqual(
    stored(settings((value) => (value.selection.actorTypes = ['human', 'bot']))),
  );
  expect(legacy.read('{invalid')).toBeNull();
  expect(
    legacy.read(
      serializeContributionPreferences(
        settings((value) => (value.selection.repositoryIds = ['repo-retired'])),
      ),
    ),
  ).toBeNull();
});
