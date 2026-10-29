import { unpreparedActivity } from '../support/contribution-activity';
import { expect, it } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import {
  validateContributionSource,
  contributionCreditKey,
} from '@/lib/presentation/contribution-source';
import {
  contributionAccountSchema,
  contributionRecordSchema,
  contributionSelectionSchema,
  type ContributionSource,
} from '@/models/contributions';

it('validates a source without mutating it and keeps credit identity independent of its date', () => {
  const source = contributionSample();
  const before = structuredClone(source);
  expect(validateContributionSource(source)).toEqual(before);
  expect(source).toEqual(before);
  const credit = source.credits[0];
  expect(contributionCreditKey(credit)).toBe(
    contributionCreditKey({ ...credit, creditedAt: '2026-01-01T00:00:00.000Z' }),
  );
});

it.each([
  [
    'duplicate account',
    (s: ContributionSource) => s.accounts.push(s.accounts[0]),
    'Duplicate account identities',
  ],
  [
    'case-insensitive duplicate login',
    (s: ContributionSource) => {
      s.accounts[1].login = s.accounts[0].login.toUpperCase();
    },
    'Duplicate account logins',
  ],
  [
    'duplicate company',
    (s: ContributionSource) => s.companies.push(s.companies[0]),
    'Duplicate company identities',
  ],
  [
    'duplicate repository',
    (s: ContributionSource) => s.repositories.push(s.repositories[0]),
    'Duplicate repository identities',
  ],
  [
    'duplicate slug',
    (s: ContributionSource) => {
      s.repositories[1].slug = s.repositories[0].slug;
    },
    'Duplicate repository slugs',
  ],
  [
    'duplicate record',
    (s: ContributionSource) => s.records.push(s.records[0]),
    'Duplicate record identities',
  ],
  [
    'duplicate number',
    (s: ContributionSource) => s.records.push({ ...s.records[0], id: 'another-record' }),
    'Duplicate repository record numbers',
  ],
  [
    'repeat credit',
    (s: ContributionSource) =>
      s.credits.push({ ...s.credits[0], creditedAt: '2026-10-01T12:00:00.000Z' }),
    'Duplicate contribution credits',
  ],
  [
    'unknown company',
    (s: ContributionSource) => {
      s.accounts[0].companyId = 'other';
    },
    'Unknown account company',
  ],
  [
    'unknown record repository',
    (s: ContributionSource) => {
      s.records[0].repositoryId = 'other';
    },
    'Unknown record identity',
  ],
  [
    'unknown record author',
    (s: ContributionSource) => {
      s.records[0].authorId = 'other';
    },
    'Unknown record identity',
  ],
  [
    'unknown credit account',
    (s: ContributionSource) => {
      s.credits[0].accountId = 'other';
    },
    'Unknown credit identity',
  ],
  [
    'unknown credit record',
    (s: ContributionSource) => {
      s.credits[0].recordId = 'other';
    },
    'Unknown credit identity',
  ],
  [
    'unknown merger',
    (s: ContributionSource) => {
      const r = s.records[0];
      if (r.kind === 'pr') r.mergerId = 'other';
    },
    'Unknown merger',
  ],
  [
    'future record',
    (s: ContributionSource) => {
      s.records[0].createdAt = '2027-01-01T12:00:00.000Z';
    },
    'Record is newer than the snapshot',
  ],
  [
    'draft merge',
    (s: ContributionSource) => {
      const r = s.records[0];
      if (r.kind === 'pr') r.draft = true;
    },
    'Invalid merged PR metadata',
  ],
  [
    'missing merge date',
    (s: ContributionSource) => {
      const r = s.records[0];
      if (r.kind === 'pr') r.mergedAt = null;
    },
    'Invalid merged PR metadata',
  ],
  [
    'merge predates creation',
    (s: ContributionSource) => {
      const r = s.records[0];
      if (r.kind === 'pr') r.mergedAt = '2026-01-01T12:00:00.000Z';
    },
    'Invalid merged PR metadata',
  ],
  [
    'future merge',
    (s: ContributionSource) => {
      const r = s.records[0];
      if (r.kind === 'pr') r.mergedAt = '2027-01-01T12:00:00.000Z';
    },
    'Invalid merged PR metadata',
  ],
  [
    'unmerged merge data',
    (s: ContributionSource) => {
      s.records[0].state = 'Open';
    },
    'Unmerged PR has merge metadata',
  ],
  [
    'wrong kind',
    (s: ContributionSource) => {
      s.credits[0].metric = 'issuesAuthored';
    },
    'Wrong contribution record kind',
  ],
  [
    'credit before record',
    (s: ContributionSource) => {
      s.credits[0].creditedAt = '2026-01-01T12:00:00.000Z';
    },
    'Credit date is outside the record/report range',
  ],
  [
    'credit outside report',
    (s: ContributionSource) => {
      s.credits[0].creditedAt = '2027-01-01T12:00:00.000Z';
    },
    'Credit date is outside the record/report range',
  ],
  [
    'wrong author',
    (s: ContributionSource) => {
      s.credits[0].accountId = 'account-bob';
    },
    'Authorship credit has the wrong actor',
  ],
  [
    'wrong author date',
    (s: ContributionSource) => {
      s.credits[0].creditedAt = '2026-08-06T12:00:00.000Z';
    },
    'Authorship credit has the wrong date',
  ],
  [
    'self reviewer',
    (s: ContributionSource) => {
      s.credits[0].metric = 'reviewerContributions';
    },
    'Author responses are not reviewer credits',
  ],
  [
    'wrong merge actor',
    (s: ContributionSource) => {
      s.credits.find((c) => c.metric === 'mergesPerformed')!.accountId = 'account-bob';
    },
    'Merge execution credit has the wrong actor',
  ],
  [
    'wrong merge date',
    (s: ContributionSource) => {
      s.credits.find((c) => c.metric === 'authoredPrsMerged')!.creditedAt =
        '2026-10-06T12:00:00.000Z';
    },
    'Merge credit requires the primary-branch merge date',
  ],
  [
    'nonprimary merge',
    (s: ContributionSource) => {
      const r = s.records[0];
      if (r.kind === 'pr') r.baseBranch = 'feature';
    },
    'Merge credit requires the primary-branch merge date',
  ],
  [
    'unavailable known credits',
    (s: ContributionSource) => {
      s.coverage.prsAuthored = { status: 'missing', reason: 'No data' };
    },
    'Unavailable coverage cannot contain known credits',
  ],
  [
    'period mismatch',
    (s: ContributionSource) => {
      s.range.start = '2026-02-01T00:00:00.000Z';
    },
    'Contribution range does not match its period and snapshot',
  ],
] as const)('rejects %s rather than publishing misleading data', (_name, mutate, message) => {
  const source = contributionSample();
  mutate(source);
  expect(() => validateContributionSource(source)).toThrow(message);
});

it('checks coverage identities and rejects ambiguous repeated overrides', () => {
  const source = contributionSample({ scenario: 'partial' });
  source.coverageOverrides.push(source.coverageOverrides[0]);
  expect(() => validateContributionSource(source)).toThrow('Duplicate coverage cells');
  source.coverageOverrides.pop();
  source.coverageOverrides[0].accountId = 'other';
  expect(() => validateContributionSource(source)).toThrow('Unknown coverage identity');
  source.coverageOverrides[0].accountId = 'account-alice';
  source.coverageOverrides[0].repositoryId = 'other';
  expect(() => validateContributionSource(source)).toThrow('Unknown coverage identity');
});
it('requires explicit per-metric coverage and honest reasons', () => {
  const source = contributionSample();
  expect(() => validateContributionSource({ ...source, coverage: {} })).toThrow();
  expect(() =>
    validateContributionSource({
      ...source,
      coverage: { ...source.coverage, prsAuthored: { status: 'partial', reason: '' } },
    }),
  ).toThrow();
});
it.each([
  'https://github.com/prebid/Prebid.js/pull/1',
  'javascript:alert(1)',
  'not a url',
  'https://name:password@github.example/pull/1',
])('rejects invented records linking to %s', (url) => {
  expect(
    contributionRecordSchema.safeParse({ ...contributionSample().records[0], url }).success,
  ).toBe(false);
});
it('keeps unknown account classification and unmapped companies explicit, and excludes group inputs', () => {
  expect(
    contributionAccountSchema.parse({
      id: 'stable',
      login: 'Mixed-Case',
      name: 'Name',
      actorType: 'unknown',
      companyId: null,
    }),
  ).toMatchObject({ id: 'stable', login: 'mixed-case', actorType: 'unknown', companyId: null });
  expect(
    contributionAccountSchema.safeParse({
      id: 'stable',
      login: 'a',
      name: 'Name',
      actorType: 'robot',
      companyId: null,
    }).success,
  ).toBe(false);
  expect(
    contributionSelectionSchema.safeParse({
      repositoryIds: [],
      actorTypes: [],
      population: { kind: 'selected', accountIds: [], companyIds: [], groupIds: ['later'] },
      excludedAccountIds: [],
    }).success,
  ).toBe(false);
});

it('includes the exact current as-of instant and excludes the next completed-period boundary', () => {
  const source = contributionSample();
  const issue = {
    id: 'boundary-issue',
    repositoryId: source.repositories[0].id,
    number: 9999,
    title: 'Boundary issue',
    url: 'https://github.example/contributions/issues/9999',
    kind: 'issue' as const,
    state: 'Open' as const,
    authorId: 'account-alice',
    createdAt: source.asOf,
  };
  const credit = {
    accountId: 'account-alice',
    recordId: issue.id,
    metric: 'issuesAuthored' as const,
    creditedAt: source.asOf,
  };
  expect(
    validateContributionSource({
      ...source,
      records: [issue],
      credits: [credit],
      activity: unpreparedActivity(),
    }).credits,
  ).toHaveLength(1);
  const completed = contributionSample({ period: { kind: 'preset', preset: 'last-month' } });
  issue.createdAt = completed.range.end;
  credit.creditedAt = completed.range.end;
  expect(() =>
    validateContributionSource({
      ...completed,
      records: [issue],
      credits: [credit],
      activity: unpreparedActivity(),
    }),
  ).toThrow('Credit date is outside the record/report range');
});
