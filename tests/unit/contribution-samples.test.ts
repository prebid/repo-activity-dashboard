import { selectContributionDetails } from '../support/contribution-details';
import { expect, it } from 'vitest';
import { repositoryCatalog } from '@/config/repositories';
import { contributionSample } from '@/mocks/contributions';
import {
  selectContributions,
  defaultContributionSelection,
} from '@/lib/presentation/contributions';
import { contributionMetricIds, type ContributionValues } from '@/models/contributions';
import { periodPresets } from '@/models/reporting-period';
const values = (metrics: ContributionValues) =>
  contributionMetricIds.map((key) => metrics[key].value);

it('uses all 18 catalog identities and a fixed reporting clock with isolated fresh results', () => {
  const first = contributionSample(),
    second = contributionSample();
  expect(first).toEqual(second);
  expect(first.asOf).toBe('2026-10-24T12:00:00.000Z');
  expect(first.repositories.map((r) => r.id)).toEqual(
    repositoryCatalog.filter((r) => r.enabled).map((r) => r.id),
  );
  expect(first.repositories).toHaveLength(18);
  first.accounts[0].name = 'Changed';
  first.repositories[0].name = 'Changed';
  first.companies[0].name = 'Changed';
  expect(contributionSample()).toEqual(second);
});
it.each(periodPresets)('produces coherent bounded sample results for %s', (preset) => {
  const sample = contributionSample({ period: { kind: 'preset', preset } });
  const report = selectContributions(sample);
  for (const metric of contributionMetricIds) {
    const details = selectContributionDetails(sample, metric);
    expect(details.measurement).toEqual(report.totals[metric]);
    if (details.measurement.value !== null)
      expect(details.rows).toHaveLength(details.measurement.value);
    for (const row of details.rows) {
      expect(new URL(row.record.url).hostname).toBe('github.example');
      expect(row.creditedAt >= sample.range.start).toBe(true);
      expect(
        sample.range.endInclusive
          ? row.creditedAt <= sample.range.end
          : row.creditedAt < sample.range.end,
      ).toBe(true);
    }
  }
});
it('marks unsupported historical ranges unavailable without relabeling another period', () => {
  const unsupported = contributionSample({
    period: { kind: 'custom', from: '2025-01-01', through: '2025-01-31' },
  });
  expect(unsupported.credits).toEqual([]);
  expect(unsupported.range.start).toBe('2025-01-01T00:00:00.000Z');
  expect(selectContributions(unsupported).totals.prsAuthored).toMatchObject({
    status: 'missing',
    value: null,
  });
  const supported = contributionSample({
    period: { kind: 'custom', from: '2026-09-03', through: '2026-09-05' },
  });
  expect(values(selectContributions(supported).totals)).toEqual([0, 0, 1, 2, 0, 0]);
});
it('retains full high-volume populations and totals before UI pagination or ranking', () => {
  const source = contributionSample({ scenario: 'large' });
  const report = selectContributions(source);
  if (report.kind !== 'overview') throw Error('Expected overview');
  expect(report.contributors).toHaveLength(251);
  expect(values(report.totals)).toEqual([490, 250, 0, 0, 250, 350]);
  expect(
    report.companies.map((row) => [row.company?.id ?? null, row.memberCount, values(row.metrics)]),
  ).toEqual([
    ['company-acme', 100, [100, 100, 0, 0, 100, 0]],
    ['company-beacon', 100, [100, 100, 0, 0, 100, 0]],
    [null, 50, [50, 50, 0, 0, 50, 0]],
    ['company-prebid', 1, [240, 0, 0, 0, 0, 350]],
  ]);
  const focus = { kind: 'contributor', accountId: 'account-heavy-agent' } as const;
  expect(selectContributionDetails(source, 'prsAuthored', undefined, focus).rows).toHaveLength(240);
  expect(selectContributionDetails(source, 'issuesAuthored', undefined, focus).rows).toHaveLength(
    350,
  );
  const selected = defaultContributionSelection(source);
  selected.excludedAccountIds = ['account-person-001'];
  const filtered = selectContributions(source, selected);
  expect(values(filtered.totals)).toEqual([489, 249, 0, 0, 249, 350]);
  if (filtered.kind !== 'overview') throw Error('Expected overview');
  expect(filtered.contributors).toHaveLength(250);
  const company = selectContributions(source, undefined, {
    kind: 'company',
    companyId: 'company-acme',
  });
  if (company.kind !== 'company') throw Error('Expected company');
  expect(company.members).toHaveLength(100);
  expect(company.repositories.reduce((sum, row) => sum + row.metrics.prsAuthored.value!, 0)).toBe(
    100,
  );
});
it('keeps primary-branch merge details and role units consistent across every catalog repository', () => {
  const source = contributionSample({ scenario: 'large' });
  const details = selectContributionDetails(source, 'mergesPerformed');
  expect(details.rows).toHaveLength(250);
  expect(new Set(details.rows.map((row) => row.repository.id)).size).toBe(18);
  expect(new Set(details.rows.map((row) => row.repository.primaryBranch))).toEqual(
    new Set(['main', 'master']),
  );
  for (const row of details.rows) {
    expect(row.record.kind).toBe('pr');
    if (row.record.kind !== 'pr') throw Error('Expected PR');
    expect(row.record.baseBranch).toBe(row.repository.primaryBranch);
    expect(row.account.id).toBe(row.record.mergerId);
    expect(row.creditedAt).toBe(row.record.mergedAt);
  }
});
it('makes source context and exact credit identities reconcile at every focused report', () => {
  const source = contributionSample({ period: { kind: 'preset', preset: 'this-month' } });
  const focuses = [
    ...source.accounts.map((account) => ({ kind: 'contributor' as const, accountId: account.id })),
    ...source.companies.map((company) => ({ kind: 'company' as const, companyId: company.id })),
    { kind: 'company' as const, companyId: null },
  ];
  for (const focus of focuses) {
    const report = selectContributions(source, undefined, focus);
    for (const metric of contributionMetricIds) {
      const details = selectContributionDetails(source, metric, undefined, focus);
      expect(details.context).toEqual(report.context);
      expect(details.measurement).toEqual(report.totals[metric]);
      expect(details.rows).toHaveLength(report.totals[metric].value!);
      expect(new Set(details.rows.map((row) => row.id)).size).toBe(details.rows.length);
    }
  }
});
it('rejects an unknown scenario instead of inventing a fallback', () => {
  // @ts-expect-error Scenario is checked at the runtime boundary too.
  expect(() => contributionSample({ scenario: 'random' })).toThrow(
    'Unknown contribution sample scenario',
  );
});

it('includes draft and closed PR authorship without pretending either is a merge', () => {
  const source = contributionSample({ scenario: 'large' });
  const focus = { kind: 'contributor', accountId: 'account-heavy-agent' } as const;
  const authored = selectContributionDetails(source, 'prsAuthored', undefined, focus);
  expect(authored.rows.find((row) => row.record.number === 1001)!.record.state).toBe('Closed');
  expect(authored.rows.find((row) => row.record.number === 1002)!.record).toMatchObject({
    kind: 'pr',
    draft: true,
  });
  expect(authored.measurement).toEqual({ status: 'complete', value: 240 });
  expect(selectContributionDetails(source, 'authoredPrsMerged', undefined, focus).rows).toEqual([]);
});
