import {
  mergeContributionPreferences,
  contributionTableScope,
  contributionPreferenceNeedsLookup,
} from '@/lib/presentation/contribution-settings';
import { resolveBack, viewOf } from '@/lib/presentation/url/back';
import { contributionScopeInput } from '@/lib/presentation/contribution-url';
import {
  readContributionPresentation,
  readContributionPresentationDocument,
  serializeContributionPresentation,
} from '@/lib/presentation/contribution-settings';
import { columnSetChange } from '@/lib/presentation/contribution-lens';
import {
  fitPreferenceCookie,
  preferenceCookieByteLimit,
  preferenceCookieBytes,
  withPreferenceSection,
  type PreferenceDocument,
} from '@/lib/presentation/preference-cookie';
import { reportMetricIds } from '@/models/contribution-metrics';
import type { PreferenceSectionKey } from '@/models/preferences';
import { contributionTableColumnIds } from '@/models/table-columns';
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
  const parent =
    '/companies?sample=partial&period=last-month&repo=prebidjs&type=human&company=company-acme&exclude=account-alice&q=Bob&sort=issuesAuthored&page=3';
  const link = contributionHref(
    { kind: 'contributor', accountId: 'account-bob' },
    'partial',
    parent,
    selected,
  )!;
  const child = viewOf(link)!;
  // The link keeps the report's scope; the report's search, sort and page belong to its frame.
  expect(contributionScopeInput(child.values)).toEqual(selected);
  expect(child.values.q).toBeUndefined();
  const [report] = resolveBack(child);
  expect(report).toMatchObject({ available: true, view: viewOf(parent) });
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

it('saves report table columns as a short version 2 diff against the lens’s defaults', () => {
  const choices = Object.fromEntries(
    ['name', 'actorType', 'company', ...reportMetricIds].map((id) => [id, true]),
  );
  const full = serializeContributionPresentation(
    choices,
    false,
    false,
    'contributors',
    'contributors',
  );
  // Every column shown is the All columns set, stored by its name.
  expect(JSON.parse(full)).toEqual({ version: 2, set: 'all', hideZeroMembers: false });
  expect(full.length).toBeLessThan(serializeContributionPresentation(choices, false).length);
  const reviewer = serializeContributionPresentation(
    { prComments: true, mergesPerformed: false, actorType: false },
    true,
    true,
    'reviewers',
    'members',
  );
  expect(JSON.parse(reviewer)).toEqual({
    version: 2,
    cols: '-actorType,-mergesPerformed,prComments',
    hideZeroMembers: true,
    showAllAccounts: true,
  });
  // A column without a choice keeps its default; the read expands every column of the table.
  const read = readContributionPresentationDocument(reviewer, 'members', 'reviewers')!;
  expect(Object.keys(read.columns)).toHaveLength(41);
  expect(Object.keys(read.columns).filter((id) => read.columns[id])).toEqual([
    'name',
    'reviewerContributions',
    'approvalContributions',
    'prComments',
  ]);
  expect(read).toMatchObject({ hideZeroMembers: true, showAllAccounts: true });
  // The same diff means other columns in the other lens; supporting records keep version 1.
  expect(
    readContributionPresentation(
      reviewer,
      ['prsAuthored', 'prComments'],
      'members',
      'contributors',
    ),
  ).toEqual({
    columns: { prsAuthored: true, prComments: true },
    hideZeroMembers: true,
    showAllAccounts: true,
  });
  expect(
    JSON.parse(
      serializeContributionPresentation({ lastAt: true }, false, true, 'reviewers', 'details'),
    ),
  ).toEqual({
    version: 1,
    columns: { lastAt: true },
    hideZeroMembers: false,
  });
  expect(readContributionPresentationDocument(reviewer, 'details')).toBeNull();
  expect(readContributionPresentation(reviewer, ['prComments'])).toEqual({
    columns: {},
    hideZeroMembers: false,
    showAllAccounts: false,
  });
  for (const raw of [
    '{"version":2,"cols":"unknown","hideZeroMembers":false}',
    '{"version":2,"cols":"a b"}',
    '{"version":2,"cols":"","showAllAccounts":"yes"}',
    '{"version":3,"cols":""}',
  ])
    expect(readContributionPresentationDocument(raw, 'contributors', 'reviewers'), raw).toBeNull();
  expect(
    readContributionPresentationDocument('{"version":2,"cols":""}', 'companies', 'reviewers'),
  ).toMatchObject({ hideZeroMembers: false, showAllAccounts: false });
});

/** The columns a stored section shows on a table of a lens, in table order. */
function shownColumns(
  raw: string,
  table: 'contributors' | 'companies' | 'members' | 'repositories',
  lens: 'contributors' | 'reviewers',
) {
  const read = readContributionPresentationDocument(raw, table, lens)!;
  return Object.keys(read.columns).filter((id) => read.columns[id]);
}
it('stores a choice that matches another Column set by the set’s name, and a Custom one as a diff', () => {
  const every = (table: keyof typeof contributionTableColumnIds) =>
    Object.fromEntries(contributionTableColumnIds[table].map((id) => [id, true]));
  for (const table of ['contributors', 'companies', 'members', 'repositories'] as const)
    for (const lens of ['contributors', 'reviewers'] as const) {
      const raw = serializeContributionPresentation(
        every(table),
        false,
        lens === 'reviewers',
        lens,
        table,
      );
      expect(JSON.parse(raw), table + ' ' + lens).toEqual({
        version: 2,
        set: 'all',
        hideZeroMembers: false,
        ...(lens === 'reviewers' && { showAllAccounts: true }),
      });
      expect(shownColumns(raw, table, lens)).toEqual([...contributionTableColumnIds[table]]);
    }
  // A set leaves identity columns as they are: they stay in `cols`, against v1.
  const contributor = serializeContributionPresentation(
    {
      actorType: false,
      prsAuthored: true,
      authoredPrsMerged: true,
      issuesAuthored: true,
      reviewerContributions: false,
      approvalContributions: false,
      mergesPerformed: false,
    },
    false,
    false,
    'reviewers',
    'contributors',
  );
  expect(JSON.parse(contributor)).toEqual({
    version: 2,
    set: 'contributor',
    cols: '-actorType',
    hideZeroMembers: false,
  });
  expect(shownColumns(contributor, 'contributors', 'reviewers')).toEqual([
    'name',
    'company',
    'prsAuthored',
    'authoredPrsMerged',
    'issuesAuthored',
  ]);
  const credits = serializeContributionPresentation(
    { reviewerContributions: true, approvalContributions: true, mergesPerformed: true },
    true,
    false,
    'contributors',
    'members',
  );
  expect(JSON.parse(credits)).toEqual({ version: 2, set: 'credits', hideZeroMembers: true });
  expect(shownColumns(credits, 'members', 'contributors')).toEqual([
    'name',
    'actorType',
    'prsAuthored',
    'authoredPrsMerged',
    'reviewerContributions',
    'approvalContributions',
    'mergesPerformed',
    'issuesAuthored',
  ]);
  // The lens's own set is its v1 columns, whose diff is shorter than the set's name.
  expect(
    JSON.parse(
      serializeContributionPresentation(
        { company: false },
        false,
        false,
        'reviewers',
        'contributors',
      ),
    ),
  ).toEqual({ version: 2, cols: '-company', hideZeroMembers: false });
  // A Custom choice is a diff against the lens's v1 columns and reads back as the same columns.
  const custom = serializeContributionPresentation(
    { prComments: true, approvalContributions: false, company: false },
    false,
    false,
    'reviewers',
    'contributors',
  );
  expect(JSON.parse(custom)).toEqual({
    version: 2,
    cols: '-company,-approvalContributions,prComments',
    hideZeroMembers: false,
  });
  expect(shownColumns(custom, 'contributors', 'reviewers')).toEqual([
    'name',
    'actorType',
    'reviewerContributions',
    'mergesPerformed',
    'prComments',
  ]);
  // A named set must be one of the four, and its diff must name the table's columns.
  for (const raw of [
    '{"version":2,"set":"retired"}',
    '{"version":2,"set":"all","cols":"unknown"}',
    '{"version":2,"set":"all","cols":1}',
    '{"version":2,"set":null,"cols":""}',
  ])
    expect(readContributionPresentationDocument(raw, 'contributors', 'reviewers'), raw).toBeNull();
});
it('keeps the saved scope when All columns is saved on both lenses’ people tables', () => {
  const binding = { accountId: 'account-0123456789abcdef0123456789abcdef', authVersion: 7 };
  let document: PreferenceDocument | null = null;
  const save = (section: PreferenceSectionKey, value: unknown) => {
    const fit = fitPreferenceCookie(
      withPreferenceSection(document, binding, section, value),
      section,
    );
    if (fit.status !== 'fits') throw Error('Expected the cookie to fit');
    expect(fit.evicted, section).toEqual([]);
    document = fit.document;
    return preferenceCookieBytes('contributions', fit.value!);
  };
  save('contributions.scope', JSON.parse(serializeContributionPreferences(defaults)));
  // The section each lens's Columns menu writes after choosing All columns.
  const allColumns = (lens: 'contributors' | 'reviewers') =>
    JSON.parse(
      serializeContributionPresentation(
        columnSetChange(
          'all',
          lens,
          { visible: {}, sort: { sort: 'name', descending: false } },
          'report',
        ).visible,
        false,
        false,
        lens,
        'contributors',
      ),
    ) as unknown;
  save('contributions.contributors.columns', allColumns('contributors'));
  const bytes = save('contributions.reviewers.contributors.columns', allColumns('reviewers'));
  expect(bytes).toBeLessThan(preferenceCookieByteLimit / 2);
  expect(Object.keys(document!.sections)).toEqual([
    'contributions.scope',
    'contributions.contributors.columns',
    'contributions.reviewers.contributors.columns',
  ]);
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
      showAllAccounts: false,
    });
  expect(readContributionPresentation('{"version":1,"columns":{"name":false}}', ['name'])).toEqual({
    columns: { name: false },
    hideZeroMembers: false,
    showAllAccounts: false,
  });
  expect(
    readContributionPresentation(serializeContributionPresentation({ name: true }, true), ['name']),
  ).toEqual({ columns: { name: true }, hideZeroMembers: true, showAllAccounts: false });
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
