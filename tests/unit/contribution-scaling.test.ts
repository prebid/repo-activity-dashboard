import { expect, it, vi } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import { validateContributionSource } from '@/lib/presentation/contribution-source';
import * as activity from '@/lib/presentation/contribution-activity';
import {
  selectContributions,
  selectContributionPresentation,
  defaultContributionSelection,
} from '@/lib/presentation/contributions';
import { reportRows } from '../support/contribution-reports';
import { changeStatIds } from '@/models/contribution-activity';

it('validates an owned immutable snapshot once and never caches mutable caller input', () => {
  const validate = vi.spyOn(activity, 'validateContributionActivity');
  try {
    const source = contributionSample();
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validateContributionSource(source)).toBe(source);
    selectContributions(source);
    selectContributions(source, undefined, undefined, { area: 'companies' });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(source.accounts[0])).toBe(true);
    expect(() => {
      source.accounts[0].name = 'Changed';
    }).toThrow();
    const mutable = structuredClone(source);
    selectContributions(mutable);
    mutable.accounts[0].name = 'Updated input';
    expect(
      reportRows(selectContributions(mutable), 'contributors').find(
        (row) => row.id === 'account-alice',
      )?.account.name,
    ).toBe('Updated input');
    mutable.credits.push(mutable.credits[0]);
    expect(() => selectContributions(mutable)).toThrow('Duplicate contribution credits');
  } finally {
    validate.mockRestore();
  }
});
it('keeps inactive directory entries out of report collections and payloads while retaining the included count', () => {
  const base = contributionSample({ scenario: 'large' }),
    input = structuredClone(base);
  for (let i = 0; i < 3000; i++)
    input.accounts.push({
      id: 'inactive-' + i,
      login: 'inactive-' + i,
      name: 'Inactive ' + i,
      companyId: null,
      actorType: 'human',
    });
  const source = validateContributionSource(input),
    original = selectContributions(base),
    expanded = selectContributions(source);
  expect(expanded.context.includedAccountCount).toBe(3251);
  expect(reportRows(expanded, 'contributors')).toEqual(reportRows(original, 'contributors'));
  expect(expanded.totals).toEqual(original.totals);
  expect(JSON.stringify(expanded)).not.toContain('inactive-');
  expect(JSON.stringify(expanded).length - JSON.stringify(original).length).toBeLessThan(20);
  const companies = selectContributions(source, undefined, undefined, { area: 'companies' });
  expect(reportRows(companies, 'companies')).toHaveLength(4);
  expect(JSON.stringify(companies)).not.toContain('Sample contributor');
  expect(JSON.stringify(companies).length).toBeLessThan(25000);
});
it('keeps sparse coverage overrides and implicit known-zero cells distinct', () => {
  const source = structuredClone(contributionSample());
  source.coverageOverrides.push({
    accountId: 'account-alice',
    repositoryId: 'repo-openrtb',
    metric: 'prsAuthored',
    coverage: { status: 'missing', reason: 'Uncollected cell' },
  });
  const selection = defaultContributionSelection(source);
  selection.repositoryIds = ['repo-openrtb', 'repo-go-gdpr'];
  const focus = { kind: 'contributor' as const, accountId: 'account-alice' };
  expect(selectContributions(source, selection, focus).totals.prsAuthored).toEqual({
    status: 'partial',
    value: 0,
    reason: 'Uncollected cell',
  });
  selection.repositoryIds = ['repo-openrtb'];
  expect(selectContributions(source, selection, focus).totals.prsAuthored).toEqual({
    status: 'missing',
    value: null,
    reason: 'Uncollected cell',
  });
  selection.repositoryIds = [];
  expect(selectContributions(source, selection, focus).totals.prsAuthored).toEqual({
    status: 'complete',
    value: 0,
  });
});
it('retains company coverage when not-applicable member values combine with known-zero members', () => {
  const source = structuredClone(contributionSample());
  source.credits = [];
  source.activity.comments = [];
  for (const record of source.records)
    if (record.kind === 'pr' && record.mergedDiff)
      for (const stat of changeStatIds)
        record.mergedDiff[stat] = {
          status: 'not-applicable',
          value: null,
          reason: 'No applicable diff',
        };
  const selection = defaultContributionSelection(source);
  selection.repositoryIds = ['repo-prebidjs'];
  selection.population = {
    kind: 'selected',
    accountIds: ['account-alice', 'account-eve'],
    companyIds: [],
  };
  const companies = selectContributions(source, selection, undefined, { area: 'companies' });
  expect(reportRows(companies, 'companies')).toHaveLength(1);
  expect(
    reportRows(companies, 'companies')[0].additionalMetrics['authored.filesChanged'],
  ).toMatchObject({ status: 'partial', value: 0 });
  expect(reportRows(selectContributions(source, selection), 'contributors')).toEqual([]);
});
it('sends no hidden table with supporting details and only the requested company breakdown', () => {
  const source = contributionSample({ scenario: 'large' }),
    selection = defaultContributionSelection(source);
  const focus = { kind: 'company' as const, companyId: 'company-acme' };
  const detail = selectContributionPresentation(source, selection, focus, 'prsAuthored');
  expect(detail.report.table).toBeNull();
  expect(detail.details?.rows).toHaveLength(100);
  expect(JSON.stringify(detail.details)).not.toContain('mergedDiff');
  const repos = selectContributions(source, selection, focus, { breakdown: 'repositories' });
  expect(reportRows(repos, 'repositories')).toHaveLength(18);
  expect(JSON.stringify(repos)).not.toContain('Sample contributor');
});
