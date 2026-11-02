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
  writeContributionSettings,
} from '@/lib/presentation/contribution-settings';
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
  contributionEntryNotices,
  resolveContributionReport,
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
async function resolve(
  sections: Partial<Record<PreferenceSectionKey, unknown>>,
  search = '',
  { area = 'contributors', focus, binding = alice } = {} as {
    area?: ContributionArea;
    focus?: Exclude<ContributionFocus, { kind: 'overview' }>;
    binding?: PreferenceBinding;
  },
) {
  const params = new URLSearchParams(search);
  const loaded = await contributions(area, params, focus);
  if (loaded.status !== 'ready') throw Error('Expected a contribution report');
  const path = focus
    ? focus.kind === 'contributor'
      ? '/contributors/' + focus.accountId
      : '/companies/id/' + focus.companyId
    : '/' + area;
  return resolveContributionReport(snapshot(sections, binding), {
    path,
    params,
    page: loaded.page,
  });
}
function ready(entry: Awaited<ReturnType<typeof resolve>>) {
  if (entry.status !== 'ready') throw Error('Expected the report to render, got a redirect');
  return entry.preferences;
}
const lastMonth = scope((value) => (value.period = { kind: 'preset', preset: 'last-month' }));

it('answers an entry with a saved scope by redirecting to its explicit-scope URL', async () => {
  const saved = scope((value) => {
    value.period = { kind: 'custom', from: '2026-09-01', through: '2026-09-30' };
    value.selection.excludedAccountIds = ['account-alice'];
  });
  const entry = await resolve({ 'contributions.scope': stored(saved) }, 'sample=reference');
  expect(entry).toEqual({
    status: 'redirect',
    href: '/contributors?' + writeContributionSettings('sample=reference', saved),
  });
  const company = await resolve({ 'contributions.scope': stored(lastMonth) }, 'view=repositories', {
    area: 'companies',
    focus: { kind: 'company', companyId: 'company-acme' },
  });
  expect(company).toEqual({
    status: 'redirect',
    href: '/companies/id/company-acme?' + writeContributionSettings('view=repositories', lastMonth),
  });
});

it('renders an entry in place when nothing is saved or the saved scope is the rendered one', async () => {
  expect(ready(await resolve({})).scope).toEqual({
    section: 'contributions.scope',
    binding: alice,
    value: null,
  });
  const same = ready(await resolve({ 'contributions.scope': stored(defaults) }));
  expect(same.scope.value).toEqual(scope());
  expect(same.notice).toBeUndefined();
});

it('keeps an explicit scope authoritative without reading or rejecting the saved one', async () => {
  const entry = ready(
    await resolve({ 'contributions.scope': '{invalid' }, 'scope=1&period=this-month'),
  );
  expect(entry.scope).toEqual({ section: 'contributions.scope', binding: alice, value: null });
  expect(entry.notice).toBeUndefined();
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
  const entry = ready(await resolve({ 'contributions.scope': stored(saved) }));
  expect(entry.notice).toBe(contributionEntryNotices.invalid);
  // The rejected value goes to the client for compare-and-delete.
  expect(entry.scope).toEqual({
    section: 'contributions.scope',
    binding: alice,
    value: null,
    invalid: JSON.stringify(stored(saved)),
  });
});

it('renders the requested view when the saved scope does not fit the link, keeping it', async () => {
  const entry = ready(
    await resolve({ 'contributions.scope': stored(lastMonth) }, 'nav=' + 'a'.repeat(7470)),
  );
  expect(entry.notice).toBe(contributionEntryNotices.unfit);
  expect(entry.scope.value).toEqual(lastMonth);
  expect(entry.scope.invalid).toBeUndefined();
});

it('ignores preferences saved for another account or authentication revision', async () => {
  for (const binding of [
    { ...alice, accountId: 'account-bob' },
    { ...alice, authVersion: 2 },
  ]) {
    const entry = ready(
      await resolve(
        {
          'contributions.scope': stored(lastMonth),
          'contributions.contributors.sort': { sort: 'name', descending: true },
        },
        '',
        { binding },
      ),
    );
    expect(entry.scope.value).toBeNull();
    expect(entry.sort.value).toBeNull();
    expect(entry.notice).toBeUndefined();
  }
});

it('validates the table kind’s column and sort sections, rejecting malformed ones', async () => {
  const columns = JSON.parse(
    serializeContributionPresentation({ prComments: true, retired: false }, true),
  ) as unknown;
  const valid = ready(
    await resolve(
      {
        'contributions.members.columns': columns,
        'contributions.members.sort': { sort: 'name', descending: true },
        'contributions.contributors.sort': { sort: 'name', descending: false },
      },
      'scope=1&view=members',
      { area: 'companies', focus: { kind: 'company', companyId: 'company-acme' } },
    ),
  );
  expect(valid.presentation).toMatchObject({
    section: 'contributions.members.columns',
    value: { columns: { prComments: true, retired: false }, hideZeroMembers: true },
  });
  expect(valid.sort).toMatchObject({
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
    const rejected = ready(
      await resolve(
        {
          'contributions.details.columns': presentation,
          'contributions.details.sort': sort,
        },
        'scope=1&period=this-year&metric=prsAuthored',
      ),
    );
    expect(rejected.presentation).toMatchObject({
      section: 'contributions.details.columns',
      value: null,
      invalid: JSON.stringify(presentation),
    });
    expect(rejected.sort).toMatchObject({
      section: 'contributions.details.sort',
      value: null,
      invalid: JSON.stringify(sort),
    });
  }
});
