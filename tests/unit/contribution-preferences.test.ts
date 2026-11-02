import { beforeEach, expect, it, vi } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import {
  encodePreferenceDocument,
  withPreferenceSection,
  type PreferenceDocument,
} from '@/lib/presentation/preference-cookie';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
  serializeContributionPresentation,
} from '@/lib/presentation/contribution-settings';
import { contributionReportRoute } from '@/lib/presentation/contribution-url';
import { isEntry, parseQuery, urlHref } from '@/lib/presentation/url/codec';
import { entryValues } from '@/lib/presentation/url/entry';
import type { ContributionSettings } from '@/models/contribution-settings';
import type { ContributionFocus } from '@/models/contributions';
import type { ContributionArea } from '@/models/contribution-page';
import type { PreferenceBinding, PreferenceSectionKey } from '@/models/preferences';

const requireViewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
import { preferenceSnapshot } from '@/server/preferences';
import {
  contributionEntry,
  contributionEntryNotices,
  contributionReportPreferences,
} from '@/server/contribution-preferences';
import { contributions } from '@/server/reporting';

const alice: PreferenceBinding = { accountId: 'sample-viewer', authVersion: 3 };
const defaults = defaultContributionSettings(contributionSample());
beforeEach(() => {
  requireViewer.mockReset().mockResolvedValue({ id: 'sample-viewer', authVersion: 3 });
});
/** A scope as the readers normalise it, with repository IDs in sorted order. */
function scope(change: (value: ContributionSettings) => void = () => {}) {
  const value = structuredClone(defaults);
  value.selection.repositoryIds.sort();
  change(value);
  return value;
}
const stored = (value: ContributionSettings): unknown =>
  JSON.parse(serializeContributionPreferences(value));
function snapshot(sections: Partial<Record<PreferenceSectionKey, unknown>>, binding = alice) {
  let document: PreferenceDocument | null = null;
  for (const [section, value] of Object.entries(sections))
    document = withPreferenceSection(document, binding, section as PreferenceSectionKey, value);
  return preferenceSnapshot(
    'contributions',
    alice,
    document ? encodePreferenceDocument(document) : undefined,
  );
}
type Target = {
  area?: ContributionArea;
  focus?: Exclude<ContributionFocus, { kind: 'overview' }>;
  binding?: PreferenceBinding;
  lens?: 'contributors' | 'reviewers';
};
/**
 * One request's entry resolution: the saved values the page helper applies (and the address it
 * redirects to), and the preferences the rendered report starts from.
 */
async function resolve(
  sections: Partial<Record<PreferenceSectionKey, unknown>>,
  search = '',
  { area = 'contributors', focus, binding = alice, lens }: Target = {},
) {
  const { route, segments } = contributionReportRoute(area, focus, lens);
  const parsed = parseQuery(route, search);
  if (parsed.kind !== 'canonical') throw Error('Expected a canonical query');
  const read = snapshot(sections, binding);
  const entry = contributionEntry(
    read,
    route,
    segments,
    parsed.values,
    isEntry(route, parsed.values),
  );
  const loaded = await contributions(area, parsed.values, focus, lens);
  if (loaded.status !== 'ready') throw Error('Expected a contribution report');
  return {
    entry,
    /** Where the helper sends the entry: its own address when nothing saved differs. */
    target: urlHref(route, segments, entryValues(route, parsed.values, entry.saved ?? {})),
    preferences: contributionReportPreferences(read, loaded.page, entry),
  };
}
const lastMonth = scope((value) => (value.period = { kind: 'preset', preset: 'last-month' }));

it('answers a list entry with its saved scope and presentation in explicit form', async () => {
  const saved = scope((value) => {
    value.period = { kind: 'custom', from: '2026-09-01', through: '2026-09-30' };
    value.selection.excludedAccountIds = ['account-alice'];
  });
  const { target, preferences } = await resolve({
    'contributions.scope': stored(saved),
    'contributions.contributors.sort': { sort: 'prsAuthored', descending: true },
    'contributions.contributors.columns': JSON.parse(
      serializeContributionPresentation({ prComments: true, issuesAuthored: false }, false),
    ) as unknown,
  });
  expect(target).toBe(
    '/contributors?period=2026-09-01..2026-09-30&exclude=account-alice' +
      '&sort=-prsAuthored&cols=-issuesAuthored,prComments',
  );
  expect(preferences.scope.value).toEqual(saved);
  expect(preferences.notice).toBeUndefined();
});

it('reads each lens’s own column and sort sections, version 1 or 2, and shares the scope', async () => {
  const sections = {
    'contributions.scope': stored(lastMonth),
    'contributions.contributors.sort': { sort: 'prsAuthored', descending: true },
    'contributions.reviewers.contributors.sort': { sort: 'mergesPerformed', descending: true },
    'contributions.reviewers.contributors.columns': JSON.parse(
      serializeContributionPresentation(
        { prComments: true, approvalContributions: false },
        false,
        true,
        'reviewers',
        'contributors',
      ),
    ) as unknown,
  };
  const reviewers = await resolve(sections, '', { lens: 'reviewers' });
  expect(reviewers.target).toBe(
    '/reviewers?period=last-month&sort=-mergesPerformed&cols=-approvalContributions,prComments&all',
  );
  expect(reviewers.preferences.presentation).toMatchObject({
    section: 'contributions.reviewers.contributors.columns',
    value: { hideZeroMembers: false, showAllAccounts: true },
  });
  expect(reviewers.preferences.sort.section).toBe('contributions.reviewers.contributors.sort');
  // The Contributors lens reads its own sections; Show all never reaches it.
  const contributors = await resolve(sections);
  expect(contributors.target).toBe('/contributors?period=last-month&sort=-prsAuthored');
  expect(contributors.preferences.presentation.section).toBe('contributions.contributors.columns');
  const companies = await resolve(
    { 'contributions.reviewers.companies.sort': { sort: 'name', descending: false } },
    'lens=reviewers',
    { area: 'companies' },
  );
  expect(companies.target).toBe('/companies?lens=reviewers&sort=name');
  const company = await resolve(
    { 'contributions.reviewers.members.columns': { version: 2, cols: '-actorType' } },
    'lens=reviewers',
    { area: 'companies', focus: { kind: 'company', companyId: 'company-acme' } },
  );
  expect(company.target).toBe('/companies/id/company-acme?lens=reviewers&cols=-actorType');
});

it('applies only saved presentation on a contributor or company entry (C2)', async () => {
  const company = await resolve(
    {
      'contributions.scope': stored(lastMonth),
      'contributions.repositories.sort': { sort: 'name', descending: false },
    },
    'view=repositories',
    { area: 'companies', focus: { kind: 'company', companyId: 'company-acme' } },
  );
  expect(company.target).toBe('/companies/id/company-acme?view=repositories&sort=name');
  // The saved scope is neither applied nor checked on a detail page.
  expect(company.preferences.scope).toEqual({
    section: 'contributions.scope',
    binding: alice,
    value: null,
  });
});

it('renders an entry in place when nothing is saved or the saved view is the default one', async () => {
  const nothing = await resolve({});
  expect(nothing.target).toBe('/contributors');
  expect(nothing.preferences.scope).toEqual({
    section: 'contributions.scope',
    binding: alice,
    value: null,
  });
  const same = await resolve({ 'contributions.scope': stored(defaults) });
  expect(same.target).toBe('/contributors');
  expect(same.preferences.scope.value).toEqual(scope());
  expect(same.preferences.notice).toBeUndefined();
});

it('keeps an explicit view authoritative without reading or rejecting the saved scope', async () => {
  const { entry, target, preferences } = await resolve(
    { 'contributions.scope': '{invalid' },
    'period=this-month',
  );
  expect(entry.saved).toBeNull();
  expect(target).toBe('/contributors?period=this-month');
  expect(preferences.scope).toEqual({
    section: 'contributions.scope',
    binding: alice,
    value: null,
  });
  expect(preferences.notice).toBeUndefined();
});

it.each([
  ['an unknown account', scope((value) => (value.selection.excludedAccountIds = ['removed']))],
  [
    'an unknown company',
    scope((value) => {
      value.selection.population = { kind: 'selected', accountIds: [], companyIds: ['removed'] };
    }),
  ],
  ['a retired repository', scope((value) => (value.selection.repositoryIds = ['repo-retired']))],
  [
    'an unresolvable range',
    scope((value) => {
      value.period = { kind: 'custom', from: '2027-01-01', through: '2027-01-02' };
    }),
  ],
])('renders defaults with the recovery notice for a saved scope naming %s', async (_, saved) => {
  const { target, preferences } = await resolve({ 'contributions.scope': stored(saved) });
  expect(target).toBe('/contributors');
  expect(preferences.notice).toBe(contributionEntryNotices.invalid);
  // The rejected value goes to the client for compare-and-delete.
  expect(preferences.scope).toEqual({
    section: 'contributions.scope',
    binding: alice,
    value: null,
    invalid: JSON.stringify(stored(saved)),
  });
});

it('renders the requested view when the saved scope does not fit the link, keeping it', async () => {
  // A parent frame that leaves too little of the 7,500-byte cap for the saved period.
  const back = 'back=~q:' + 'a'.repeat(7470);
  const { target, preferences } = await resolve({ 'contributions.scope': stored(lastMonth) }, back);
  expect(target).toBe('/contributors?' + back);
  expect(preferences.notice).toBe(contributionEntryNotices.unfit);
  expect(preferences.scope.value).toEqual(lastMonth);
  expect(preferences.scope.invalid).toBeUndefined();
});

it('ignores preferences saved for another account or authentication revision', async () => {
  for (const binding of [
    { ...alice, accountId: 'account-bob' },
    { ...alice, authVersion: 2 },
  ]) {
    const { target, preferences } = await resolve(
      {
        'contributions.scope': stored(lastMonth),
        'contributions.contributors.sort': { sort: 'name', descending: true },
      },
      '',
      { binding },
    );
    expect(target).toBe('/contributors');
    expect(preferences.scope.value).toBeNull();
    expect(preferences.sort.value).toBeNull();
    expect(preferences.notice).toBeUndefined();
  }
});

it('validates the table kind’s column and sort sections, rejecting malformed ones', async () => {
  const columns = JSON.parse(
    serializeContributionPresentation({ prComments: true, retired: false }, true),
  ) as unknown;
  const valid = await resolve(
    {
      'contributions.members.columns': columns,
      'contributions.members.sort': { sort: 'name', descending: true },
      'contributions.contributors.sort': { sort: 'name', descending: false },
    },
    'period=this-year',
    { area: 'companies', focus: { kind: 'company', companyId: 'company-acme' } },
  );
  expect(valid.preferences.presentation).toMatchObject({
    section: 'contributions.members.columns',
    value: { columns: { prComments: true, retired: false }, hideZeroMembers: true },
  });
  expect(valid.preferences.sort).toMatchObject({
    section: 'contributions.members.sort',
    value: { sort: 'name', descending: true },
  });
  for (const [presentation, sort] of [
    [{ version: 2, columns: {} }, { sort: 'name' }],
    [
      { version: 1, columns: [] },
      { sort: 3, descending: true },
    ],
    [{ version: 1, columns: {}, hideZeroMembers: 'yes' }, 'name'],
  ] as const) {
    const rejected = await resolve(
      {
        'contributions.details.columns': presentation,
        'contributions.details.sort': sort,
      },
      'metric=prsAuthored',
    );
    expect(rejected.preferences.presentation).toMatchObject({
      section: 'contributions.details.columns',
      value: null,
      invalid: JSON.stringify(presentation),
    });
    expect(rejected.preferences.sort).toMatchObject({
      section: 'contributions.details.sort',
      value: null,
      invalid: JSON.stringify(sort),
    });
  }
});
