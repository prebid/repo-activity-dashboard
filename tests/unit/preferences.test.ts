import { beforeEach, expect, it, vi } from 'vitest';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import {
  encodePreferenceDocument,
  withPreferenceSection,
  type PreferenceDocument,
} from '@/lib/presentation/preference-cookie';
import {
  defaultOverviewSettings,
  serializeOverviewPreferences,
} from '@/lib/presentation/overview-settings';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
  validateContributionSettings,
} from '@/lib/presentation/contribution-settings';
import type { PreferenceSectionKey } from '@/models/preferences';

const { requireViewer, jar } = vi.hoisted(() => ({
  requireViewer: vi.fn(),
  jar: new Map<string, string>(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer }));
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    }),
}));
import {
  preferenceSnapshot,
  readPreferences,
  savedContributionScope,
  savedOverviewSettings,
  savedPreference,
  savedTableColumns,
  savedTableSort,
  savedTimelinePresentation,
} from '@/server/preferences';

const alice = { accountId: 'account-alice', authVersion: 2 };
function cookie(sections: Partial<Record<PreferenceSectionKey, unknown>>, binding = alice) {
  let document: PreferenceDocument | null = null;
  for (const [section, value] of Object.entries(sections))
    document = withPreferenceSection(document, binding, section as PreferenceSectionKey, value);
  return encodePreferenceDocument(document!);
}
const repositories = (sections: Partial<Record<PreferenceSectionKey, unknown>>) =>
  preferenceSnapshot('repositories', alice, cookie(sections));
beforeEach(() => {
  jar.clear();
  requireViewer.mockReset().mockResolvedValue({
    id: 'account-alice',
    email: 'alice@example.test',
    role: 'user',
    authVersion: 2,
  });
});

it('reads each cookie for the signed-in session and ignores one saved for another', async () => {
  jar.set(
    'dashboard-repositories',
    cookie({ 'repository.prs.sort': { sort: 'a', descending: true } }),
  );
  jar.set(
    'dashboard-contributions',
    cookie({ 'contributions.scope': {} }, { ...alice, accountId: 'account-bob' }),
  );
  const repositoriesRead = await readPreferences('repositories');
  expect(repositoriesRead).toMatchObject({
    cookie: 'repositories',
    binding: alice,
    status: 'bound',
  });
  expect(savedTableSort(repositoriesRead, 'repository.prs.sort', ['a'])).toEqual({
    section: 'repository.prs.sort',
    binding: alice,
    value: { sort: 'a', descending: true },
  });
  const contributionsRead = await readPreferences('contributions');
  expect(contributionsRead).toMatchObject({ status: 'ignored', document: null });
  expect(
    savedPreference(contributionsRead, 'contributions.scope', () => {
      throw Error('An ignored cookie is never read');
    }),
  ).toEqual({ section: 'contributions.scope', binding: alice, value: null });
  requireViewer.mockResolvedValue({ id: 'account-alice', authVersion: 3 });
  expect((await readPreferences('repositories')).status).toBe('ignored');
  requireViewer.mockRejectedValue(Error('denied'));
  await expect(readPreferences('repositories')).rejects.toThrow('denied');
});

it('marks absent, valid, not-applicable and invalid sections', () => {
  const snapshot = repositories({
    'repository.prs.sort': { sort: 'createdAt', descending: false },
    'repository.issues.sort': { sort: 'retiredColumn', descending: true },
    'overview.backlog.sort': { sort: 3 },
  });
  expect(savedTableSort(snapshot, 'repository.merged-prs.sort', ['createdAt'])).toEqual({
    section: 'repository.merged-prs.sort',
    binding: alice,
    value: null,
  });
  expect(savedTableSort(snapshot, 'repository.prs.sort', ['createdAt']).value).toEqual({
    sort: 'createdAt',
    descending: false,
  });
  // A well-formed sort on a column this table lacks stays saved for the tables that have it.
  expect(savedTableSort(snapshot, 'repository.issues.sort', ['createdAt'])).toEqual({
    section: 'repository.issues.sort',
    binding: alice,
    value: null,
  });
  expect(savedTableSort(snapshot, 'overview.backlog.sort', ['name'])).toEqual({
    section: 'overview.backlog.sort',
    binding: alice,
    value: null,
    invalid: '{"sort":3}',
  });
  expect(
    savedPreference(snapshot, 'repository.prs.sort', () => {
      throw Error('reader failure');
    }).invalid,
  ).toBe('{"sort":"createdAt","descending":false}');
  expect(() => savedPreference(snapshot, 'contributions.scope', () => 1)).toThrow(
    'not in the repositories cookie',
  );
  expect(preferenceSnapshot('repositories', alice, 'garbage')).toMatchObject({
    status: 'malformed',
    document: null,
  });
});

it('validates columns, All repositories settings and Timeline presentation with their readers', () => {
  const definition = {
    repositoryIds: ['a', 'b'],
    backlogColumns: ['name', 'total'],
    activityColumns: ['name', 'opened'],
    defaultBacklogColumns: ['name'],
    defaultActivityColumns: ['name'],
  };
  const asOf = '2026-10-24T12:00:00.000Z';
  const settings = { ...defaultOverviewSettings(definition), repositoryIds: ['b'] };
  const snapshot = repositories({
    'repository.prs.columns': { version: 1, columns: { ageDays: false, retired: true } },
    'repository.issues.columns': { version: 1, columns: ['ageDays'] },
    overview: JSON.parse(serializeOverviewPreferences(settings)),
    'timeline.matrix': { version: 1, query: 'timeline.group=week&timeline.dir=desc' },
    'timeline.repository': { version: 1, query: 'timeline.unknown=1' },
  });
  expect(savedTableColumns(snapshot, 'repository.prs.columns', ['ageDays']).value).toEqual({
    ageDays: false,
  });
  expect(savedTableColumns(snapshot, 'repository.issues.columns', ['ageDays']).invalid).toBe(
    '{"version":1,"columns":["ageDays"]}',
  );
  expect(savedOverviewSettings(snapshot, definition, asOf).value).toEqual(settings);
  expect(savedTimelinePresentation(snapshot, 'timeline.matrix', 'matrix').value).toBe(
    'timeline.group=week&timeline.dir=desc',
  );
  expect(savedTimelinePresentation(snapshot, 'timeline.repository', 'repository')).toMatchObject({
    value: null,
    invalid: '{"version":1,"query":"timeline.unknown=1"}',
  });
});

it('checks a saved scope against the directory instead of a client lookup', () => {
  const directory = contributionSample();
  const scope = defaultContributionSettings(directory);
  const known = {
    ...scope,
    selection: { ...scope.selection, excludedAccountIds: ['account-alice'] },
  };
  const unknown = {
    ...scope,
    selection: { ...scope.selection, excludedAccountIds: ['account-retired'] },
  };
  const read = (value: unknown) =>
    savedContributionScope(
      preferenceSnapshot('contributions', alice, cookie({ 'contributions.scope': value })),
      directory,
      contributionSampleAsOf,
    );
  expect(read(JSON.parse(serializeContributionPreferences(known))).value).toEqual(
    validateContributionSettings(known, directory, contributionSampleAsOf),
  );
  const rejected = read(JSON.parse(serializeContributionPreferences(unknown)));
  expect(rejected.value).toBeNull();
  expect(JSON.parse(rejected.invalid!)).toEqual(
    JSON.parse(serializeContributionPreferences(unknown)),
  );
  expect(read({ version: 9 }).invalid).toBe('{"version":9}');
});
