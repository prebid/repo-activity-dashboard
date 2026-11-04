import { describe, expect, it } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import { contributionMetricIds } from '@/models/contributions';
import { changeStatIds } from '@/models/contribution-activity';
import type { ContributionExportRequest } from '@/models/contribution-export';
import { validateContributionSource } from '@/lib/presentation/contribution-source';
import {
  defaultContributionSelection,
  selectContributions,
  selectContributionExport,
} from '@/lib/presentation/contributions';
import { reportRows } from '../support/contribution-reports';
import { unpreparedActivity } from '../support/contribution-activity';

const request: ContributionExportRequest = {
  area: 'contributors',
  focus: { kind: 'overview' },
  breakdown: 'members',
  layout: 'summary',
  identityColumns: ['company'],
  metrics: ['prsAuthored'],
  query: { search: '', sort: 'name', descending: false, page: 1 },
};
function gapSource(kind: 'core' | 'additional' | 'both') {
  const source = structuredClone(contributionSample({ scenario: 'large' }));
  if (kind !== 'additional')
    source.coverage.reviewerContributions = {
      status: 'partial',
      reason: 'Early history incomplete',
    };
  if (kind !== 'core') source.activity = unpreparedActivity();
  return source;
}
it.each(['core', 'additional', 'both'] as const)(
  'keeps %s period-wide gaps out of row eligibility as the directory grows',
  (kind) => {
    const base = validateContributionSource(gapSource(kind));
    const input = structuredClone(base);
    input.companies.push({ id: 'company-idle', name: 'No recorded contributors' });
    for (let i = 0; i < 3000; i++)
      input.accounts.push({
        id: 'idle-' + i,
        login: 'idle-' + i,
        name: 'Idle ' + i,
        companyId: 'company-idle',
        actorType: 'human',
      });
    const source = validateContributionSource(input);
    for (const area of ['contributors', 'companies'] as const) {
      const original = selectContributions(base, undefined, undefined, { area });
      const expanded = selectContributions(source, undefined, undefined, { area });
      expect(expanded.context.includedAccountCount).toBe(3251);
      expect(expanded.table).toEqual(original.table);
      expect(expanded.totals).toEqual(original.totals);
      expect(expanded.additionalTotals).toEqual(original.additionalTotals);
      expect(JSON.stringify(expanded)).not.toContain('idle-');
      expect(JSON.stringify(expanded).length - JSON.stringify(original).length).toBeLessThan(20);
      expect(expanded).toMatchObject({ contributorCount: 251, companyCount: 4 });
      expect(expanded.table?.rows).toHaveLength(area === 'contributors' ? 251 : 4);
      const summary = selectContributionExport(source, defaultContributionSelection(source), {
        ...request,
        area,
      });
      expect(summary.rows).toHaveLength(expanded.table!.rows.length);
      expect(summary.rows.some((row) => row.entityId.includes('idle'))).toBe(false);
      const flat = selectContributionExport(source, defaultContributionSelection(source), {
        ...request,
        area,
        layout: 'repositories',
      });
      expect(new Set(flat.rows.map((row) => row.entityId))).toEqual(
        new Set(summary.rows.map((row) => row.entityId)),
      );
    }
  },
);
it.each(['missing', 'partial'] as const)(
  'retains account-specific %s coverage while a complete-zero override cannot borrow global uncertainty',
  (status) => {
    const input = structuredClone(contributionSample({ scenario: 'empty' }));
    input.coverage.reviewerContributions = { status: 'partial', reason: 'Global gap' };
    input.coverageOverrides.push(
      {
        accountId: 'account-alice',
        repositoryId: 'repo-prebidjs',
        metric: 'reviewerContributions',
        coverage: { status, reason: 'Alice history incomplete' },
      },
      {
        accountId: 'account-eve',
        repositoryId: 'repo-prebidjs',
        metric: 'reviewerContributions',
        coverage: { status: 'complete' },
      },
    );
    const source = validateContributionSource(input),
      selection = defaultContributionSelection(source);
    const report = selectContributions(source, selection);
    expect(reportRows(report, 'contributors').map((row) => row.id)).toEqual(['account-alice']);
    expect(report).toMatchObject({ contributorCount: 1, companyCount: 1 });
    const companies = selectContributions(source, selection, undefined, { area: 'companies' });
    expect(reportRows(companies, 'companies').map((row) => row.company?.id)).toEqual([
      'company-acme',
    ]);
    expect(reportRows(companies, 'companies')[0].memberCount).toBe(3);
    expect(companies.totals.reviewerContributions.status).toBe('partial');
    selection.repositoryIds = ['repo-prebidserver'];
    expect(reportRows(selectContributions(source, selection), 'contributors')).toEqual([]);
    selection.repositoryIds = ['repo-prebidjs'];
    selection.excludedAccountIds = ['account-alice'];
    expect(selectContributions(source, selection)).toMatchObject({
      contributorCount: 0,
      companyCount: 0,
    });
    selection.excludedAccountIds = [];
    selection.actorTypes = ['bot'];
    expect(reportRows(selectContributions(source, selection), 'contributors')).toEqual([]);
  },
);
it('keeps comment-only accounts eligible even when only core metrics are exported', () => {
  const input = structuredClone(contributionSample());
  const record = input.records.find((row) => row.kind === 'issue')!;
  input.credits = [];
  input.activity = unpreparedActivity();
  input.activity.coverage.issueComments = { status: 'complete' };
  input.activity.comments = [
    {
      id: 'comment-only',
      accountId: 'account-eve',
      recordId: record.id,
      kind: 'issueComments',
      createdAt: input.asOf,
    },
  ];
  input.coverage.reviewerContributions = { status: 'partial', reason: 'Global gap' };
  const source = validateContributionSource(input);
  const rows = reportRows(selectContributions(source), 'contributors');
  expect(rows.map((row) => row.id)).toEqual(['account-eve']);
  expect(rows[0].metrics.prsAuthored.value).toBe(0);
  expect(rows[0].additionalMetrics.issueComments.value).toBe(1);
  expect(
    selectContributionExport(source, defaultContributionSelection(source), request).rows.map(
      (row) => row.entityId,
    ),
  ).toEqual(['account-eve']);
});
it.each(['positive', 'missing', 'partial-zero', 'zero', 'not-applicable'] as const)(
  'uses %s record-specific merged volume, independently of core credits',
  (state) => {
    const input = structuredClone(contributionSample());
    const record = input.records.find((row) => row.kind === 'pr' && row.number === 101)!;
    if (record.kind !== 'pr') throw Error('Expected PR');
    const volume = input.activity.volumes.find(
      (row) => row.recordId === record.id && row.role === 'authored',
    )!;
    input.records = [record];
    input.credits = [];
    input.activity.comments = [];
    input.activity.volumes = [volume];
    if (state === 'missing') {
      delete record.mergedDiff;
      input.activity.coverage = unpreparedActivity().coverage;
    } else if (state !== 'positive')
      for (const stat of changeStatIds)
        record.mergedDiff![stat] =
          state === 'zero'
            ? { status: 'complete', value: 0 }
            : state === 'partial-zero'
              ? { status: 'partial', value: 0, reason: 'Incomplete record diff' }
              : { status: 'not-applicable', value: null, reason: 'No applicable volume' };
    input.coverage.reviewerContributions = { status: 'partial', reason: 'Global gap' };
    const source = validateContributionSource(input),
      report = selectContributions(source);
    const expected =
      state === 'positive' || state === 'missing' || state === 'partial-zero'
        ? ['account-alice']
        : [];
    expect(reportRows(report, 'contributors').map((row) => row.id)).toEqual(expected);
    expect(report).toMatchObject({
      contributorCount: expected.length,
      companyCount: expected.length,
    });
    expect(
      selectContributionExport(source, defaultContributionSelection(source), request).rows.map(
        (row) => row.entityId,
      ),
    ).toEqual(expected);
    if (state === 'missing')
      expect(report.additionalTotals['authored.filesChanged'].value).toBeNull();
  },
);
it('distinguishes a globally unavailable overview from complete zero and from an empty selected population', () => {
  const missing = contributionSample({ scenario: 'missing' }),
    report = selectContributions(missing);
  expect(report).toMatchObject({ contributorCount: 0, companyCount: 0 });
  expect(reportRows(report, 'contributors')).toEqual([]);
  for (const metric of contributionMetricIds)
    expect(report.totals[metric]).toMatchObject({ status: 'missing', value: null });
  const selected = defaultContributionSelection(missing);
  selected.population = { kind: 'selected', accountIds: [], companyIds: [] };
  for (const value of Object.values(selectContributions(missing, selected).totals))
    expect(value).toEqual({ status: 'complete', value: 0 });
  const empty = selectContributions(contributionSample({ scenario: 'empty' }));
  expect(reportRows(empty, 'contributors')).toEqual([]);
  expect(empty.totals.prsAuthored).toEqual({ status: 'complete', value: 0 });
});
it('preserves explicit contributor reports and complete company member rosters under global gaps', () => {
  const source = contributionSample({ scenario: 'missing' });
  const person = selectContributions(source, undefined, {
    kind: 'contributor',
    accountId: 'account-eve',
  });
  expect(person.kind).toBe('contributor');
  expect(reportRows(person, 'repositories')).toHaveLength(18);
  expect(person.totals.prsAuthored.value).toBeNull();
  const company = selectContributions(source, undefined, {
    kind: 'company',
    companyId: 'company-acme',
  });
  expect(reportRows(company, 'members').map((row) => row.id)).toEqual([
    'account-alice',
    'account-bob',
    'account-eve',
  ]);
});

describe('the Reviewers lens population', () => {
  const reviewers = { lens: 'reviewers' } as const;
  const ids = (
    report: ReturnType<typeof selectContributions>,
    kind: 'contributors' | 'companies',
  ) =>
    kind === 'contributors'
      ? reportRows(report, kind).map((row) => row.id)
      : reportRows(report, kind).map((row) => row.company?.id ?? null);
  it('lists review, approval and merge credits, and incomplete reviewer history', () => {
    const reference = contributionSample();
    const people = selectContributions(reference, undefined, undefined, reviewers);
    // Finn authored an issue and commented on it: in the Contributors lens only.
    expect(ids(selectContributions(reference), 'contributors')).toContain('account-finn');
    expect(ids(people, 'contributors')).not.toContain('account-finn');
    expect(people).toMatchObject({
      contributorCount: 6,
      companyCount: 4,
      population: {
        role: 'reviewer',
        showingAll: false,
        allContributorCount: 7,
        allCompanyCount: 4,
      },
    });
    expect(selectContributions(reference)).not.toHaveProperty('population');
    // An account-specific missing reviewer history qualifies; a period-wide gap does not.
    const withGap = structuredClone(reference);
    withGap.coverageOverrides.push({
      accountId: 'account-finn',
      repositoryId: reference.repositories[1].id,
      metric: 'approvalContributions',
      coverage: { status: 'missing', reason: 'Approvals unavailable for this account.' },
    });
    expect(
      ids(selectContributions(withGap, undefined, undefined, reviewers), 'contributors'),
    ).toContain('account-finn');
    const gap = contributionSample({ scenario: 'coverage-gap' });
    expect(selectContributions(gap, undefined, undefined, reviewers)).toMatchObject({
      contributorCount: 250,
      companyCount: 3,
    });
  });
  it('counts a self-merge as reviewer evidence', () => {
    const large = selectContributions(
      contributionSample({ scenario: 'large' }),
      undefined,
      undefined,
      reviewers,
    );
    // Person 100 only authored and merged their own PR; the heavy agent never merged one.
    expect(ids(large, 'contributors')).toContain('account-person-100');
    expect(ids(large, 'contributors')).not.toContain('account-heavy-agent');
    if (large.kind !== 'overview') throw Error('Expected overview');
    expect([large.contributorCount, large.population?.allContributorCount]).toEqual([250, 251]);
  });
  it('qualifies companies through a reviewer member and totals every selected member', () => {
    const reference = contributionSample();
    const view = { ...reviewers, area: 'companies' } as const;
    const companies = selectContributions(reference, undefined, undefined, view);
    const beacon = reportRows(companies, 'companies').find(
      (row) => row.company?.id === 'company-beacon',
    )!;
    // Finn is not a reviewer, but his issue still counts in Beacon's totals and member count.
    expect(beacon.memberCount).toBe(2);
    expect(beacon.metrics.issuesAuthored.value).toBe(2);
    const large = contributionSample({ scenario: 'large' });
    expect(ids(selectContributions(large, undefined, undefined, view), 'companies')).toEqual([
      'company-acme',
      'company-beacon',
      null,
    ]);
    // Show all restores the all-activity population.
    const all = selectContributions(large, undefined, undefined, { ...view, allAccounts: true });
    expect(all).toMatchObject({
      companyCount: 4,
      population: { showingAll: true, allCompanyCount: 4 },
    });
    expect(ids(all, 'companies')).toContain('company-prebid');
  });
  it.each([
    ['reference', 7, 4, 6, 4],
    ['partial', 7, 4, 6, 4],
    ['large', 251, 4, 250, 3],
    ['coverage-gap', 251, 4, 250, 3],
    ['missing', 0, 0, 0, 0],
    ['empty', 0, 0, 0, 0],
  ] as const)('lists the %s sample’s people and companies in each lens', (scenario, ...counts) => {
    const source = contributionSample({ scenario });
    const lens = (view: object) => {
      const report = selectContributions(source, undefined, undefined, view);
      return [
        report.kind === 'overview' && report.contributorCount,
        report.kind === 'overview' && report.companyCount,
      ];
    };
    expect([...lens({}), ...lens(reviewers)]).toEqual(counts);
  });
  it('exports the lens’s population, and hides members with no reviewer credit', () => {
    const reference = contributionSample();
    const exported = selectContributionExport(reference, defaultContributionSelection(reference), {
      ...request,
      lens: 'reviewers',
    });
    expect(exported.rows.map((row) => row.entityId)).not.toContain('account-finn');
    expect(exported.rows).toHaveLength(6);
    const all = selectContributionExport(reference, defaultContributionSelection(reference), {
      ...request,
      lens: 'reviewers',
      allAccounts: true,
    });
    expect(all.rows).toHaveLength(7);
    const members = (lens: 'contributors' | 'reviewers') =>
      selectContributionExport(reference, defaultContributionSelection(reference), {
        ...request,
        lens,
        focus: { kind: 'company', companyId: 'company-beacon' },
        hideZeroMembers: true,
      }).rows.map((row) => row.entityId);
    expect(members('contributors')).toEqual(['account-carol', 'account-finn']);
    expect(members('reviewers')).toEqual(['account-carol']);
  });
});

describe('the Companies lens population', () => {
  const companyIds = (view: object, scenario: Parameters<typeof contributionSample>[0]) =>
    reportRows(
      selectContributions(contributionSample(scenario), undefined, undefined, {
        area: 'companies',
        ...view,
      }),
      'companies',
    ).map((row) => [row.company?.id ?? null, row.memberCount]);
  it.each(['reference', 'large', 'coverage-gap', 'empty'] as const)(
    'lists the %s sample’s companies with any activity, as the Contributors lens does',
    (scenario) => {
      const companies = companyIds({ lens: 'all' }, { scenario });
      expect(companies).toEqual(companyIds({}, { scenario }));
      const report = selectContributions(contributionSample({ scenario }), undefined, undefined, {
        area: 'companies',
        lens: 'all',
      });
      // No population role, so no Show all switch.
      expect(report).not.toHaveProperty('population');
    },
  );
  it('exports any activity, and hides only members with no credit at all', () => {
    const reference = contributionSample();
    const selection = defaultContributionSelection(reference);
    expect(
      selectContributionExport(reference, selection, { ...request, lens: 'all' }).rows,
    ).toEqual(selectContributionExport(reference, selection, request).rows);
    const members = selectContributionExport(reference, selection, {
      ...request,
      lens: 'all',
      focus: { kind: 'company', companyId: 'company-beacon' },
      hideZeroMembers: true,
    }).rows.map((row) => row.entityId);
    expect(members).toEqual(['account-carol', 'account-finn']);
  });
});
