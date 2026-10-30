import {
  mergeContributionPreferences,
  contributionTableScope,
  contributionPreferenceNeedsLookup,
} from '@/lib/presentation/contribution-settings';
import { contributionReturnHref } from '@/lib/presentation/contribution-return';
import {
  readContributionPresentation,
  serializeContributionPresentation,
} from '@/lib/presentation/contribution-settings';
import { expect, it } from 'vitest';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { contributionHref } from '@/lib/presentation/contribution-navigation';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  hasContributionScope,
  readContributionPeriod,
  readContributionPreferences,
  readContributionSettings,
  serializeContributionPreferences,
  validateContributionSettings,
  writeContributionSettings,
} from '@/lib/presentation/contribution-settings';
const directory = contributionSample();
const defaults = defaultContributionSettings(directory);
it('checks mapped-company identities remotely while recognizing the unmapped sentinel locally', () => {
  const settings = {
    ...defaults,
    selection: {
      ...defaults.selection,
      population: {
        kind: 'selected' as const,
        accountIds: [],
        companyIds: ['company-acme'] as (string | null)[],
      },
    },
  };
  expect(contributionPreferenceNeedsLookup(settings)).toBe(true);
  settings.selection.population.companyIds = [null];
  expect(contributionPreferenceNeedsLookup(settings)).toBe(false);
});
it('does not mistake repeated selections for all repositories or all account types', () => {
  const settings = {
    ...defaults,
    selection: {
      ...defaults.selection,
      repositoryIds: Array.from({ length: directory.repositories.length }, () => 'repo-prebidjs'),
      actorTypes: ['human', 'human', 'human', 'human'] as const,
    },
  };
  const query = writeContributionSettings('', {
    ...settings,
    selection: { ...settings.selection, actorTypes: [...settings.selection.actorTypes] },
  });
  expect(read(query)?.selection.repositoryIds).toEqual(['repo-prebidjs']);
  expect(read(query)?.selection.actorTypes).toEqual(['human']);
});
function read(search: string) {
  return readContributionSettings(new URLSearchParams(search), directory, contributionSampleAsOf);
}
it('uses YTD/all defaults and round trips explicit none without expanding the selection', () => {
  expect(read('')?.period).toEqual({ kind: 'preset', preset: 'this-year' });
  expect(read('')?.selection.repositoryIds).toHaveLength(18);
  const empty = read('repo=&type=&population=selected')!;
  expect(empty.selection).toEqual({
    repositoryIds: [],
    actorTypes: [],
    population: { kind: 'selected', accountIds: [], companyIds: [] },
    excludedAccountIds: [],
  });
  expect(read(writeContributionSettings('', empty))).toEqual(empty);
  expect(hasContributionScope(new URLSearchParams('report.page=2'))).toBe(false);
  expect(hasContributionScope(new URLSearchParams('exclude=account-alice'))).toBe(true);
});
it('validates dates and every identity before reporting, including custom bounds and unmapped companies', () => {
  const selected = read(
    'period=custom&from=2026-10-01&through=2026-10-31&population=selected&company=&company=company-acme&account=account-alice&account=account-alice&exclude=account-alice&type=human&type=human&repo=repo-prebidjs',
  )!;
  expect(selected.period).toEqual({ kind: 'custom', from: '2026-10-01', through: '2026-10-31' });
  expect(selected.selection.population).toEqual({
    kind: 'selected',
    accountIds: ['account-alice'],
    companyIds: ['company-acme', null],
  });
  expect(selected.selection.actorTypes).toEqual(['human']);
  expect(read(writeContributionSettings('', selected))).toEqual(selected);
  for (const search of [
    'period=never',
    'period=',
    'scope=2',
    'period=custom&from=2026-02-30&through=2026-03-01',
    'period=custom&from=2027-01-01&through=2027-01-02',
    'period=custom&from=2026-10-10&through=2026-10-01',
    'from=2026-01-01',
    'repo=unknown',
    'type=robot',
    'account=absent',
    'company=absent',
    'exclude=absent',
    'population=group',
    'population=all&account=account-alice',
  ])
    expect(read(search), search).toBeNull();
});
it('preserves table context and complete scope in focused links, resetting only pages on scope changes', () => {
  const selected = read(
    'period=last-month&repo=repo-prebidjs&type=human&population=selected&company=company-acme&exclude=account-alice',
  )!;
  const before =
    'sample=partial&report.page=3&report.q=Bob&report.sort=issuesAuthored&members.page=2&repositories.page=4';
  const updated = new URLSearchParams(writeContributionSettings(before, selected, true));
  expect(updated.get('report.q')).toBe('Bob');
  expect(updated.get('report.sort')).toBe('issuesAuthored');
  expect(['report', 'members', 'repositories'].every((key) => !updated.has(key + '.page'))).toBe(
    true,
  );
  const parent = '/companies?' + writeContributionSettings(before, selected);
  const link = new URL(
    contributionHref(
      { kind: 'contributor', accountId: 'account-bob' },
      'partial',
      parent,
      selected,
    )!,
    'https://example.test',
  );
  expect(read(link.search)).toEqual(selected);
  expect(
    new URL(
      contributionReturnHref(link.searchParams, '/contributors'),
      'https://example.test',
    ).searchParams.get('report.q'),
  ).toBe('Bob');
  expect(
    read(
      new URL(contributionReturnHref(link.searchParams, '/contributors'), 'https://example.test')
        .search,
    ),
  ).toEqual(selected);
  expect(link.searchParams.has('report.q')).toBe(false);
});
it('isolates saved report identities, retains relative dates and rejects malformed/stale settings', () => {
  expect(contributionPreferenceKey('alice', 'reference')).not.toBe(
    contributionPreferenceKey('bob', 'reference'),
  );
  expect(contributionPreferenceKey('alice', 'reference')).not.toBe(
    contributionPreferenceKey('alice', 'large'),
  );
  const settings = read('period=this-week&exclude=account-alice')!;
  expect(
    readContributionPreferences(
      serializeContributionPreferences(settings),
      directory,
      contributionSampleAsOf,
    ),
  ).toEqual(settings);
  for (const raw of [
    null,
    '{',
    '{}',
    '[]',
    JSON.stringify({ version: 2, settings }),
    JSON.stringify({
      version: 1,
      settings: {
        ...settings,
        selection: { ...settings.selection, excludedAccountIds: ['removed-person'] },
      },
    }),
  ])
    expect(readContributionPreferences(raw, directory, contributionSampleAsOf)).toBeNull();
  expect(
    validateContributionSettings(
      { ...defaults, period: { kind: 'custom', from: '2027-01-01', through: '2027-01-01' } },
      directory,
      contributionSampleAsOf,
    ),
  ).toBeNull();
  expect(
    readContributionPeriod(new URLSearchParams('period=custom'), contributionSampleAsOf),
  ).toBeNull();
});

it('reads legacy and current member presentation preferences without trusting malformed browser values', () => {
  for (const raw of [
    null,
    '{',
    'null',
    '[]',
    '{}',
    '{"version":2,"hideZeroMembers":true}',
    '{"version":1,"hideZeroMembers":"true"}',
  ])
    expect(readContributionPresentation(raw, ['name'])).toEqual({
      columns: {},
      hideZeroMembers: false,
    });
  expect(readContributionPresentation('{"version":1,"columns":{"name":false}}', ['name'])).toEqual({
    columns: { name: false },
    hideZeroMembers: false,
  });
  expect(
    readContributionPresentation(serializeContributionPresentation({ name: true }, true), ['name']),
  ).toEqual({ columns: { name: true }, hideZeroMembers: true });
});
it('persists only explicit filter intent, including an unchanged repository chosen deliberately', () => {
  const saved = defaultContributionSettings(directory);
  const current = {
    ...saved,
    selection: {
      ...saved.selection,
      repositoryIds: ['repo-prebidjs'],
      actorTypes: ['human'] as const,
    },
  };
  const live = {
    ...current,
    selection: { ...current.selection, actorTypes: [...current.selection.actorTypes] },
  };
  expect(mergeContributionPreferences(saved, live, 'repositoryIds').selection).toEqual({
    ...saved.selection,
    repositoryIds: ['repo-prebidjs'],
  });
  expect(mergeContributionPreferences(saved, live, 'actorTypes').selection).toEqual({
    ...saved.selection,
    actorTypes: ['human'],
  });
  const next = {
    ...live,
    period: { kind: 'preset' as const, preset: 'last-month' as const },
    selection: {
      ...live.selection,
      population: { kind: 'selected' as const, accountIds: ['account-bob'], companyIds: [] },
      excludedAccountIds: ['account-alice'],
    },
  };
  expect(mergeContributionPreferences(saved, next, 'period')).toEqual({
    ...saved,
    period: next.period,
  });
  expect(mergeContributionPreferences(saved, next, 'population')).toEqual({
    ...saved,
    selection: {
      ...saved.selection,
      population: next.selection.population,
      excludedAccountIds: next.selection.excludedAccountIds,
    },
  });
  expect(contributionTableScope('reference', 'repositories')).not.toBe(
    contributionTableScope('large', 'repositories'),
  );
  expect(contributionTableScope('reference', 'repositories')).not.toBe(
    contributionTableScope('reference', 'members'),
  );
});
