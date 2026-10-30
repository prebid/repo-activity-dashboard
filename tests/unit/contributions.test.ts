import { reportRows } from '../support/contribution-reports';
import { selectContributionDetails } from '../support/contribution-details';
import { unpreparedActivity } from '../support/contribution-activity';
import { expect, it } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import {
  contributionMetricIds,
  contributionDefaultSort,
  contributionDefaultPeriod,
  type ContributionValues,
  type ContributionSelection,
} from '@/models/contributions';
import {
  selectContributions,
  defaultContributionSelection,
} from '@/lib/presentation/contributions';

const month = { kind: 'preset', preset: 'this-month' } as const;
const values = (metrics: ContributionValues) =>
  contributionMetricIds.map((key) => metrics[key].value);
const r1 = 'repo-prebidjs',
  r2 = 'repo-prebidserver';

it('uses the agreed defaults and all six independent metric columns', () => {
  expect(contributionDefaultPeriod).toEqual({ kind: 'preset', preset: 'this-year' });
  expect(contributionDefaultSort).toEqual({ sort: 'authoredPrsMerged', descending: true });
  expect(contributionMetricIds).toEqual([
    'prsAuthored',
    'authoredPrsMerged',
    'reviewerContributions',
    'approvalContributions',
    'mergesPerformed',
    'issuesAuthored',
  ]);
});
it('matches independently specified October contributor and company answers', () => {
  const source = structuredClone(contributionSample({ period: month }));
  const report = selectContributions(source);
  if (report.kind !== 'overview') throw Error('Expected overview');
  expect(values(report.totals)).toEqual([6, 4, 6, 4, 4, 4]);
  expect(reportRows(report, 'contributors').map((r) => [r.account.id, values(r.metrics)])).toEqual([
    ['account-alice', [1, 1, 1, 2, 0, 0]],
    ['account-bob', [2, 1, 0, 0, 1, 1]],
    ['account-carol', [1, 1, 1, 0, 1, 1]],
    ['account-drew', [2, 1, 0, 0, 1, 0]],
    ['account-finn', [0, 0, 0, 0, 0, 1]],
    ['account-agent', [0, 0, 2, 2, 1, 1]],
    ['account-bot', [0, 0, 2, 0, 0, 0]],
  ]);
  expect(
    reportRows(
      selectContributions(source, report.context.selection, report.context.focus, {
        area: 'companies',
      }),
      'companies',
    ).map((r) => [r.company?.id ?? null, values(r.metrics)]),
  ).toEqual([
    ['company-acme', [3, 2, 1, 2, 1, 1]],
    ['company-beacon', [1, 1, 1, 0, 1, 2]],
    [null, [2, 1, 2, 0, 1, 0]],
    ['company-prebid', [0, 0, 2, 2, 1, 1]],
  ]);
  expect(report.context).toMatchObject({
    source: 'sample',
    companyAttribution: 'current-mapping',
    asOf: '2026-10-24T12:00:00.000Z',
    period: month,
  });
  expect(source.accounts.find((a) => a.id === 'account-eve')).toBeDefined();
});
it('retains zero members while omitting confirmed-zero repository rows on focused reports', () => {
  const source = structuredClone(contributionSample({ period: month }));
  const report = selectContributions(source, undefined, {
    kind: 'company',
    companyId: 'company-acme',
  });
  if (report.kind !== 'company') throw Error('Expected company');
  expect(reportRows(report, 'members').map((r) => r.id)).toEqual([
    'account-alice',
    'account-bob',
    'account-eve',
  ]);
  expect(values(reportRows(report, 'members')[2].metrics)).toEqual([0, 0, 0, 0, 0, 0]);
  expect(
    reportRows(
      selectContributions(source, report.context.selection, report.context.focus, {
        breakdown: 'repositories',
      }),
      'repositories',
    ).map((row) => row.repository.id),
  ).toEqual([r1, r2]);
  for (const metric of contributionMetricIds)
    expect(
      reportRows(
        selectContributions(source, report.context.selection, report.context.focus, {
          breakdown: 'repositories',
        }),
        'repositories',
      ).reduce((n, row) => n + row.metrics[metric].value!, 0),
    ).toBe(report.totals[metric].value);
  const person = selectContributions(source, undefined, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  if (person.kind !== 'contributor') throw Error('Expected contributor');
  expect(values(reportRows(person, 'repositories').find((row) => row.id === r1)!.metrics)).toEqual([
    0, 1, 1, 1, 0, 0,
  ]);
  expect(values(reportRows(person, 'repositories').find((row) => row.id === r2)!.metrics)).toEqual([
    1, 0, 0, 1, 0, 0,
  ]);
});
it('unions individual/company selection once and lets exclusions win without remapping members', () => {
  const source = structuredClone(contributionSample({ period: month }));
  const selection = defaultContributionSelection(source);
  selection.population = {
    kind: 'selected',
    accountIds: ['account-alice', 'account-alice'],
    companyIds: ['company-acme', 'company-acme'],
  };
  expect(values(selectContributions(source, selection).totals)).toEqual([3, 2, 1, 2, 1, 1]);
  selection.excludedAccountIds = ['account-alice'];
  const result = selectContributions(source, selection);
  expect(values(result.totals)).toEqual([2, 1, 0, 0, 1, 1]);
  expect(result.context.includedAccountCount).toBe(2);
  expect(source.accounts.find((a) => a.id === 'account-alice')!.companyId).toBe('company-acme');
  for (const metric of contributionMetricIds)
    expect(
      selectContributionDetails(source, metric, selection).rows.every(
        (row) => row.account.id !== 'account-alice',
      ),
    ).toBe(true);
});
it('focus narrows the current selection without reintroducing excluded accounts', () => {
  const source = structuredClone(contributionSample({ period: month }));
  const selection = defaultContributionSelection(source);
  selection.excludedAccountIds = ['account-alice'];
  selection.repositoryIds = [r2];
  const person = selectContributions(source, selection, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  expect(values(person.totals)).toEqual([0, 0, 0, 0, 0, 0]);
  expect(person.context.includedAccountCount).toBe(0);
  expect(
    selectContributionDetails(source, 'prsAuthored', selection, {
      kind: 'contributor',
      accountId: 'account-alice',
    }).rows,
  ).toEqual([]);
  selection.population = { kind: 'selected', accountIds: ['account-carol'], companyIds: [] };
  const company = selectContributions(source, selection, {
    kind: 'company',
    companyId: 'company-acme',
  });
  if (company.kind !== 'company') throw Error('Expected company');
  expect(reportRows(company, 'members')).toEqual([]);
  expect(values(company.totals)).toEqual([0, 0, 0, 0, 0, 0]);
});
it.each(['population', 'repositories', 'actors'] as const)(
  'preserves an explicit empty %s selection',
  (kind) => {
    const source = structuredClone(contributionSample());
    const selection = defaultContributionSelection(source);
    if (kind === 'population')
      selection.population = { kind: 'selected', accountIds: [], companyIds: [] };
    if (kind === 'repositories') selection.repositoryIds = [];
    if (kind === 'actors') selection.actorTypes = [];
    const result = selectContributions(source, selection);
    expect(values(result.totals)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(selectContributionDetails(source, 'prsAuthored', selection).rows).toEqual([]);
  },
);
it('preserves per-repository contribution attribution and actor categories', () => {
  const source = structuredClone(contributionSample({ period: month }));
  const selection = defaultContributionSelection(source);
  selection.actorTypes = ['human'];
  expect(values(selectContributions(source, selection).totals)).toEqual([6, 4, 2, 2, 3, 3]);
  selection.actorTypes = ['agent'];
  expect(values(selectContributions(source, selection).totals)).toEqual([0, 0, 2, 2, 1, 1]);
  selection.actorTypes = ['bot'];
  expect(values(selectContributions(source, selection).totals)).toEqual([0, 0, 2, 0, 0, 0]);
  source.accounts.find((a) => a.id === 'account-drew')!.actorType = 'unknown';
  selection.actorTypes = ['unknown'];
  expect(values(selectContributions(source, selection).totals)).toEqual([2, 1, 0, 0, 1, 0]);
  selection.actorTypes = ['human', 'agent', 'bot', 'unknown'];
  selection.repositoryIds = [r1, r1];
  expect(
    values(
      selectContributions(source, selection, { kind: 'contributor', accountId: 'account-alice' })
        .totals,
    ),
  ).toEqual([0, 1, 1, 1, 0, 0]);
});
it('regroups current company mapping without changing personal credits or identities', () => {
  const source = structuredClone(contributionSample({ period: month }));
  const before = selectContributionDetails(source, 'approvalContributions');
  const alice = source.accounts.find((a) => a.id === 'account-alice')!;
  alice.companyId = 'company-beacon';
  alice.login = 'renamed-sample';
  alice.name = 'Renamed';
  const report = selectContributions(source);
  if (report.kind !== 'overview') throw Error('Expected overview');
  expect(
    values(
      reportRows(
        selectContributions(source, report.context.selection, report.context.focus, {
          area: 'companies',
        }),
        'companies',
      ).find((row) => row.company?.id === 'company-acme')!.metrics,
    ),
  ).toEqual([2, 1, 0, 0, 1, 1]);
  expect(
    values(
      reportRows(
        selectContributions(source, report.context.selection, report.context.focus, {
          area: 'companies',
        }),
        'companies',
      ).find((row) => row.company?.id === 'company-beacon')!.metrics,
    ),
  ).toEqual([2, 2, 2, 2, 1, 2]);
  expect(selectContributionDetails(source, 'approvalContributions').rows.map((r) => r.id)).toEqual(
    before.rows.map((r) => r.id),
  );
  expect(
    values(
      selectContributions(source, undefined, { kind: 'contributor', accountId: 'account-alice' })
        .totals,
    ),
  ).toEqual([1, 1, 1, 2, 0, 0]);
});
it('keeps two approval contributions on one PR distinct from one covered PR', () => {
  const source = structuredClone(
    contributionSample({ period: { kind: 'preset', preset: 'last-month' } }),
  );
  const details = selectContributionDetails(source, 'approvalContributions', undefined, {
    kind: 'company',
    companyId: 'company-acme',
  });
  expect(details.measurement).toEqual({ status: 'complete', value: 2 });
  expect(details.rows).toHaveLength(2);
  expect(new Set(details.rows.map((row) => row.record.id)).size).toBe(1);
  expect(new Set(details.rows.map((row) => row.id)).size).toBe(2);
  expect(details.rows.map((row) => row.account.id)).toEqual(['account-alice', 'account-bob']);
});
it('reconciles disjoint months with combined credit totals without crediting later repeats', () => {
  const august = structuredClone(
    contributionSample({
      period: { kind: 'custom', from: '2026-08-01', through: '2026-08-31' },
    }),
  );
  const september = structuredClone(
    contributionSample({ period: { kind: 'preset', preset: 'last-month' } }),
  );
  const october = structuredClone(contributionSample({ period: month }));
  expect(values(selectContributions(august).totals)).toEqual([1, 0, 1, 1, 0, 1]);
  expect(values(selectContributions(september).totals)).toEqual([1, 1, 2, 2, 1, 1]);
  expect(values(selectContributions(contributionSample()).totals)).toEqual([8, 5, 9, 7, 5, 6]);
  for (const metric of contributionMetricIds) {
    const rows = [august, september, october].flatMap(
      (s) => selectContributionDetails(s, metric).rows,
    );
    const combined = selectContributionDetails(contributionSample(), metric);
    expect(rows.map((r) => r.id).sort()).toEqual(combined.rows.map((r) => r.id).sort());
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  }
  const bob = selectContributionDetails(september, 'approvalContributions', undefined, {
    kind: 'contributor',
    accountId: 'account-bob',
  });
  expect(bob.rows.map((r) => r.record.number)).toEqual([102]);
  const alice = selectContributionDetails(october, 'approvalContributions', undefined, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  expect(alice.rows.map((r) => r.record.number)).toEqual([103, 107]);
});
it('keeps partial known subtotals, missing values, known zero and empty selections distinct', () => {
  const source = structuredClone(contributionSample({ scenario: 'partial', period: month }));
  const person = selectContributions(source, undefined, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  expect(person.totals.approvalContributions).toMatchObject({ status: 'partial', value: 1 });
  const selected = defaultContributionSelection(source);
  selected.repositoryIds = [r1];
  const drew = selectContributions(source, selected, {
    kind: 'contributor',
    accountId: 'account-drew',
  });
  expect(drew.totals.reviewerContributions).toMatchObject({ status: 'missing', value: null });
  const report = selectContributions(source);
  expect(report.totals.reviewerContributions).toMatchObject({ status: 'partial', value: 6 });
  expect(selectContributionDetails(source, 'approvalContributions').measurement).toMatchObject({
    status: 'partial',
    value: 3,
  });
  expect(
    selectContributionDetails(source, 'approvalContributions', undefined, {
      kind: 'contributor',
      accountId: 'account-alice',
    }).rows.map((row) => row.record.number),
  ).toEqual([103]);
  const unavailable = selectContributions(contributionSample({ scenario: 'missing' }));
  expect(unavailable.totals.prsAuthored).toMatchObject({ status: 'missing', value: null });
  if (unavailable.kind !== 'overview') throw Error('Expected overview');
  expect(reportRows(unavailable, 'contributors')).toHaveLength(0);
  expect(unavailable.companyCount).toBe(0);
  const empty = selectContributions(contributionSample({ scenario: 'empty' }));
  expect(empty.totals.prsAuthored).toEqual({ status: 'complete', value: 0 });
  if (empty.kind !== 'overview') throw Error('Expected overview');
  expect(reportRows(empty, 'contributors')).toEqual([]);
  expect(empty.companyCount).toBe(0);
});
it('supports unmapped company focus without assigning accounts to a guessed company', () => {
  const source = structuredClone(contributionSample({ period: month }));
  const selection = defaultContributionSelection(source);
  selection.population = { kind: 'selected', accountIds: [], companyIds: [null] };
  const report = selectContributions(source, selection, { kind: 'company', companyId: null });
  if (report.kind !== 'company') throw Error('Expected company');
  expect(report.company).toBeNull();
  expect(reportRows(report, 'members').map((row) => row.id)).toEqual([
    'account-drew',
    'account-bot',
  ]);
  expect(values(report.totals)).toEqual([2, 1, 2, 0, 1, 0]);
});
it.each([
  { repositoryIds: ['unknown'] },
  { excludedAccountIds: ['unknown'] },
  { population: { kind: 'selected', accountIds: ['unknown'], companyIds: [] } },
  { population: { kind: 'selected', accountIds: [], companyIds: ['unknown'] } },
] satisfies Partial<ContributionSelection>[])(
  'rejects unknown selection identities %#',
  (patch) => {
    const source = structuredClone(contributionSample());
    expect(() =>
      selectContributions(source, { ...defaultContributionSelection(source), ...patch }),
    ).toThrow(/Unknown/);
  },
);
it('rejects unknown focused entities and metrics instead of broadening the report', () => {
  const source = structuredClone(contributionSample());
  expect(() =>
    selectContributions(source, undefined, { kind: 'contributor', accountId: 'missing' }),
  ).toThrow('Unknown contribution focus');
  expect(() =>
    selectContributions(source, undefined, { kind: 'company', companyId: 'missing' }),
  ).toThrow('Unknown contribution focus');
  // @ts-expect-error A metric outside the six-column contract is rejected at both boundaries.
  expect(() => selectContributionDetails(source, 'comments')).toThrow(
    'Unknown contribution metric',
  );
});

it('keeps explicit focused identity in details and all of one author’s repository contributions', () => {
  const source = structuredClone(contributionSample());
  const focus = { kind: 'contributor', accountId: 'account-alice' } as const;
  const details = selectContributionDetails(source, 'prsAuthored', undefined, focus);
  expect(details.context.focus).toEqual(focus);
  expect(details.measurement).toEqual({ status: 'complete', value: 2 });
  expect(details.rows.map((row) => row.repository.id)).toEqual([r1, r2]);
});

it('keeps prior-year review/approval credits separate from this-year authorship and merge execution', () => {
  const base = structuredClone(contributionSample());
  const record = { ...base.records[0], createdAt: '2025-12-20T12:00:00.000Z' };
  if (record.kind !== 'pr') throw Error('Expected PR');
  record.mergedAt = '2026-02-01T12:00:00.000Z';
  const priorCredits = [
    {
      accountId: 'account-alice',
      recordId: record.id,
      metric: 'prsAuthored' as const,
      creditedAt: record.createdAt,
    },
    {
      accountId: 'account-bob',
      recordId: record.id,
      metric: 'reviewerContributions' as const,
      creditedAt: '2025-12-21T12:00:00.000Z',
    },
    {
      accountId: 'account-bob',
      recordId: record.id,
      metric: 'approvalContributions' as const,
      creditedAt: '2025-12-22T12:00:00.000Z',
    },
  ];
  const currentCredits = [
    {
      accountId: 'account-alice',
      recordId: record.id,
      metric: 'authoredPrsMerged' as const,
      creditedAt: record.mergedAt,
    },
    {
      accountId: 'account-carol',
      recordId: record.id,
      metric: 'mergesPerformed' as const,
      creditedAt: record.mergedAt,
    },
  ];
  const previous = {
    ...base,
    period: { kind: 'preset', preset: 'last-full-year' } as const,
    range: {
      start: '2025-01-01T00:00:00.000Z',
      end: '2026-01-01T00:00:00.000Z',
      endInclusive: false,
    },
    records: [record],
    credits: priorCredits,
    activity: unpreparedActivity(),
  };
  const current = {
    ...base,
    records: [record],
    credits: currentCredits,
    activity: unpreparedActivity(),
  };
  expect(values(selectContributions(previous).totals)).toEqual([1, 0, 1, 1, 0, 0]);
  expect(values(selectContributions(current).totals)).toEqual([0, 1, 0, 0, 1, 0]);
  expect(selectContributionDetails(current, 'approvalContributions').rows).toEqual([]);
  // Supplying a prior-year credit as this year's work is rejected, not counted again.
  expect(() =>
    selectContributions({ ...current, credits: [...currentCredits, priorCredits[2]] }),
  ).toThrow('Credit date is outside the record/report range');
});
