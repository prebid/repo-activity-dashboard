import { expect, it } from 'vitest';
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
