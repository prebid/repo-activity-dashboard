import { reportRows } from '../support/contribution-reports';
import { expect, it } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import {
  selectContributions,
  defaultContributionSelection,
} from '@/lib/presentation/contributions';
import { validateContributionSource } from '@/lib/presentation/contribution-source';
import { sumContributionCounts } from '@/lib/presentation/contribution-activity';
import {
  additionalMetricIds,
  additionalMetricDefinitions,
  changeStatIds,
  fileStatusStats,
  volumeMetricId,
  volumeRoles,
  type AdditionalValues,
} from '@/models/contribution-activity';
import type { ContributionSource } from '@/models/contributions';
const values = (activity: AdditionalValues, role: (typeof volumeRoles)[number]) =>
  changeStatIds.map((stat) => activity[volumeMetricId(role, stat)].value);
it('defines all 33 optional metrics with distinct units and complete role/status coverage', () => {
  expect(new Set(additionalMetricIds).size).toBe(33);
  expect(additionalMetricIds).toHaveLength(33);
  expect(Object.keys(additionalMetricDefinitions).sort()).toEqual([...additionalMetricIds].sort());
  for (const metric of additionalMetricIds) {
    expect(additionalMetricDefinitions[metric].description.length).toBeGreaterThan(40);
    expect(additionalMetricDefinitions[metric].label).not.toBe('');
  }
  expect(fileStatusStats).toEqual([
    'filesAdded',
    'filesRemoved',
    'filesModified',
    'filesRenamed',
    'filesCopied',
    'filesTypeChanged',
  ]);
});
it('matches independently prepared file and line totals for authors, reviewers and approvers', () => {
  const report = selectContributions(contributionSample());
  expect(values(report.additionalTotals, 'authored')).toEqual([
    27, 6, 3, 12, 2, 2, 2, 600, 460, 140,
  ]);
  expect(values(report.additionalTotals, 'reviewed')).toEqual([
    36, 8, 5, 14, 3, 3, 3, 920, 700, 220,
  ]);
  expect(values(report.additionalTotals, 'approved')).toEqual([
    32, 6, 4, 14, 3, 3, 2, 700, 530, 170,
  ]);
  expect(report.additionalTotals.prComments).toEqual({ status: 'complete', value: 8 });
  expect(report.additionalTotals.inlineComments).toEqual({ status: 'complete', value: 5 });
  expect(report.additionalTotals.issueComments).toEqual({ status: 'complete', value: 3 });
});
it('uses merge dates for every volume role even when review/approval credits were earned earlier', () => {
  const october = structuredClone(
    contributionSample({ period: { kind: 'preset', preset: 'this-month' } }),
  );
  const bob = selectContributions(october, undefined, {
    kind: 'contributor',
    accountId: 'account-bob',
  });
  expect(bob.totals.reviewerContributions.value).toBe(0);
  expect(bob.totals.approvalContributions.value).toBe(0);
  expect(bob.additionalTotals['reviewed.linesChanged']).toEqual({ status: 'complete', value: 160 });
  expect(bob.additionalTotals['approved.linesChanged']).toEqual({ status: 'complete', value: 160 });
  const august = selectContributions(
    contributionSample({ period: { kind: 'custom', from: '2026-08-01', through: '2026-08-31' } }),
  );
  expect(august.totals.approvalContributions.value).toBe(1);
  expect(august.additionalTotals['approved.linesChanged'].value).toBe(0);
  const september = selectContributions(
    contributionSample({ period: { kind: 'preset', preset: 'last-month' } }),
  );
  const combined = selectContributions(contributionSample());
  for (const metric of additionalMetricIds)
    expect(
      (august.additionalTotals[metric].value ?? 0) +
        (september.additionalTotals[metric].value ?? 0) +
        (selectContributions(october).additionalTotals[metric].value ?? 0),
    ).toBe(combined.additionalTotals[metric].value);
});
it('credits both reviewers with the full final diff once, and preserves that unit in company totals', () => {
  const source = structuredClone(
    contributionSample({ period: { kind: 'preset', preset: 'last-month' } }),
  );
  const alice = selectContributions(source, undefined, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  const bob = selectContributions(source, undefined, {
    kind: 'contributor',
    accountId: 'account-bob',
  });
  expect(alice.additionalTotals['reviewed.filesChanged'].value).toBe(6);
  expect(bob.additionalTotals['reviewed.filesChanged'].value).toBe(6);
  const company = selectContributions(source, undefined, {
    kind: 'company',
    companyId: 'company-acme',
  });
  expect(company.additionalTotals['reviewed.filesChanged'].value).toBe(12);
  expect(company.additionalTotals['reviewed.linesChanged'].value).toBe(240);
  expect(company.additionalTotals['approved.linesChanged'].value).toBe(240);
});
it('counts author replies and repeated comment activity without inventing more reviewer credits', () => {
  const october = structuredClone(
    contributionSample({ period: { kind: 'preset', preset: 'this-month' } }),
  );
  const alice = selectContributions(october, undefined, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  expect(alice.additionalTotals.prComments.value).toBe(2);
  expect(alice.totals.reviewerContributions.value).toBe(1);
  const september = structuredClone(
    contributionSample({ period: { kind: 'preset', preset: 'last-month' } }),
  );
  const bob = selectContributions(september, undefined, {
    kind: 'contributor',
    accountId: 'account-bob',
  });
  expect(bob.additionalTotals.inlineComments.value).toBe(2);
  expect(bob.totals.reviewerContributions.value).toBe(1);
});
it('includes comment-only accounts even when optional columns are hidden and keeps exclusions effective', () => {
  const source = structuredClone(contributionSample());
  const issue = source.records.find((record) => record.kind === 'issue')!;
  source.activity.comments.push({
    id: 'eve-comment',
    accountId: 'account-eve',
    recordId: issue.id,
    kind: 'issueComments',
    createdAt: '2026-10-12T12:00:00.000Z',
  });
  const report = selectContributions(source);
  if (report.kind !== 'overview') throw Error('Expected overview');
  const eve = reportRows(report, 'contributors').find((row) => row.id === 'account-eve')!;
  expect(eve).toBeDefined();
  expect(eve.metrics.prsAuthored.value).toBe(0);
  expect(eve.additionalMetrics.issueComments.value).toBe(1);
  const selection = defaultContributionSelection(source);
  selection.excludedAccountIds = ['account-eve'];
  expect(selectContributions(source, selection).additionalTotals.issueComments.value).toBe(3);
  selection.actorTypes = ['agent', 'bot'];
  expect(
    selectContributions(source, selection).additionalTotals['reviewed.filesChanged'].value,
  ).toBe(14);
});
it('reconciles every complete role breakdown and keeps missing file classifications honest', () => {
  for (const scenario of ['reference', 'large'] as const) {
    const source = structuredClone(contributionSample({ scenario }));
    const report = selectContributions(source);
    for (const role of volumeRoles) {
      const totals = report.additionalTotals;
      expect(
        fileStatusStats.reduce((sum, stat) => sum + totals[volumeMetricId(role, stat)].value!, 0),
      ).toBe(totals[volumeMetricId(role, 'filesChanged')].value);
      expect(
        totals[volumeMetricId(role, 'linesAdded')].value! +
          totals[volumeMetricId(role, 'linesRemoved')].value!,
      ).toBe(totals[volumeMetricId(role, 'linesChanged')].value);
    }
  }
  const partial = selectContributions(contributionSample({ scenario: 'partial' }), undefined, {
    kind: 'contributor',
    accountId: 'account-alice',
  });
  expect(partial.additionalTotals['authored.filesChanged']).toEqual({
    status: 'complete',
    value: 10,
  });
  expect(partial.additionalTotals['authored.filesModified']).toMatchObject({
    status: 'partial',
    value: 0,
  });
  const source = structuredClone(contributionSample());
  const first = source.records.find((record) => record.kind === 'pr' && record.number === 101)!;
  if (first.kind !== 'pr') throw Error('Expected PR');
  delete first.mergedDiff;
  expect(selectContributions(source).additionalTotals['authored.filesChanged']).toMatchObject({
    status: 'partial',
    value: 17,
  });
  const missing = selectContributions(contributionSample({ scenario: 'missing' }));
  expect(missing.additionalTotals.prComments).toMatchObject({ status: 'missing', value: null });
  const empty = selectContributions(contributionSample({ scenario: 'empty' }));
  expect(empty.additionalTotals.prComments).toEqual({ status: 'complete', value: 0 });
  expect(reportRows(empty, 'contributors')).toEqual([]);
  expect(reportRows(missing, 'contributors')).toEqual([]);
});
it('propagates explicit partial collection while an empty account selection remains a known zero', () => {
  const source = structuredClone(contributionSample());
  source.activity.coverage.prComments = { status: 'partial', reason: 'Some comments unavailable' };
  expect(selectContributions(source).additionalTotals.prComments).toMatchObject({
    status: 'partial',
    value: 8,
  });
  const selection = defaultContributionSelection(source);
  selection.actorTypes = [];
  expect(selectContributions(source, selection).additionalTotals.prComments).toEqual({
    status: 'complete',
    value: 0,
  });
});
it.each([
  [
    'duplicate comment',
    (s: ContributionSource) => s.activity.comments.push(s.activity.comments[0]),
    'Duplicate comment identity',
  ],
  [
    'unknown commenter',
    (s: ContributionSource) => {
      s.activity.comments[0].accountId = 'absent';
    },
    'Unknown comment identity',
  ],
  [
    'unknown comment record',
    (s: ContributionSource) => {
      s.activity.comments[0].recordId = 'absent';
    },
    'Unknown comment identity',
  ],
  [
    'wrong comment kind',
    (s: ContributionSource) => {
      s.activity.comments[0].kind = 'issueComments';
    },
    'Wrong comment record kind',
  ],
  [
    'early comment',
    (s: ContributionSource) => {
      s.activity.comments[0].createdAt = '2026-01-01T00:00:00.000Z';
    },
    'Comment is outside',
  ],
  [
    'future comment',
    (s: ContributionSource) => {
      s.activity.comments[0].createdAt = '2027-01-01T00:00:00.000Z';
    },
    'Comment is outside',
  ],
  [
    'missing comment coverage',
    (s: ContributionSource) => {
      s.activity.coverage.prComments = { status: 'missing', reason: 'Unavailable' };
    },
    'Unavailable comment coverage',
  ],
  [
    'duplicate volume',
    (s: ContributionSource) => s.activity.volumes.push(s.activity.volumes[0]),
    'Duplicate account/PR/volume role',
  ],
  [
    'unknown volume actor',
    (s: ContributionSource) => {
      s.activity.volumes[0].accountId = 'absent';
    },
    'Unknown volume identity',
  ],
  [
    'wrong volume record',
    (s: ContributionSource) => {
      s.activity.volumes[0].recordId = s.records.find((r) => r.kind === 'issue')!.id;
    },
    'Volume requires a primary-branch PR',
  ],
  [
    'unmerged volume',
    (s: ContributionSource) => {
      s.activity.volumes[0].recordId = s.records.find(
        (r) => r.kind === 'pr' && r.state === 'Open',
      )!.id;
    },
    'Volume requires a primary-branch PR',
  ],
  [
    'early qualification',
    (s: ContributionSource) => {
      s.activity.volumes[0].qualifiedAt = '2026-01-01T00:00:00.000Z';
    },
    'Volume participation must precede',
  ],
  [
    'late qualification',
    (s: ContributionSource) => {
      s.activity.volumes[0].qualifiedAt = '2026-10-24T12:00:00.000Z';
    },
    'Volume participation must precede',
  ],
  [
    'wrong role actor',
    (s: ContributionSource) => {
      s.activity.volumes[0].accountId = 'account-bob';
    },
    'Wrong volume role actor',
  ],
  [
    'self reviewer',
    (s: ContributionSource) => {
      s.activity.volumes[0].role = 'reviewed';
    },
    'Wrong volume role actor',
  ],
  [
    'missing volume coverage',
    (s: ContributionSource) => {
      s.activity.coverage['authored.filesChanged'] = { status: 'missing', reason: 'Unavailable' };
    },
    'Unavailable volume coverage',
  ],
  [
    'omitted author volume',
    (s: ContributionSource) => {
      s.activity.volumes.shift();
    },
    'Complete volume coverage omitted',
  ],
  [
    'mismatched qualification',
    (s: ContributionSource) => {
      s.activity.volumes.find((v) => v.role === 'reviewed')!.qualifiedAt =
        '2026-08-05T12:00:00.000Z';
    },
    'Volume evidence predates',
  ],
] as const)('rejects %s', (_label, mutate, error) => {
  const source = structuredClone(contributionSample());
  mutate(source);
  expect(() => validateContributionSource(source)).toThrow(error);
});
it('rejects inconsistent file/line totals and final-diff values on an unmerged PR', () => {
  const source = structuredClone(contributionSample());
  const record = source.records.find((r) => r.kind === 'pr' && r.state === 'Merged')!;
  if (record.kind !== 'pr' || !record.mergedDiff) throw Error('Expected diff');
  record.mergedDiff.filesChanged = { status: 'complete', value: 9 };
  expect(() => validateContributionSource(source)).toThrow('filesChanged does not reconcile');
  record.mergedDiff.filesChanged = { status: 'complete', value: 11 };
  expect(() => validateContributionSource(source)).toThrow('filesChanged does not reconcile');
  record.mergedDiff.filesChanged = { status: 'complete', value: 10 };
  record.mergedDiff.linesChanged = { status: 'complete', value: 150 };
  expect(() => validateContributionSource(source)).toThrow('linesChanged does not reconcile');
  record.mergedDiff.linesChanged = { status: 'complete', value: 160 };
  const open = source.records.find((r) => r.kind === 'pr' && r.state === 'Open')!;
  if (open.kind !== 'pr') throw Error('Expected PR');
  open.mergedDiff = record.mergedDiff;
  expect(() => validateContributionSource(source)).toThrow(
    'Unmerged PR cannot have final merged diff values',
  );
});
it('handles missing, not-applicable and overflow values without converting them into zeros', () => {
  expect(sumContributionCounts([])).toEqual({ status: 'complete', value: 0 });
  expect(
    sumContributionCounts([{ status: 'not-applicable', value: null, reason: 'Binary diff' }]),
  ).toMatchObject({ status: 'not-applicable', value: null });
  expect(
    sumContributionCounts([{ status: 'missing', value: null, reason: 'Unknown' }]),
  ).toMatchObject({ status: 'missing', value: null });
  expect(
    sumContributionCounts([
      { status: 'complete', value: 3 },
      { status: 'missing', value: null, reason: 'Unknown' },
    ]),
  ).toEqual({ status: 'partial', value: 3, reason: 'Unknown' });
  expect(() =>
    sumContributionCounts([
      { status: 'complete', value: Number.MAX_SAFE_INTEGER },
      { status: 'complete', value: 1 },
    ]),
  ).toThrow('safe count range');
  const invalid = structuredClone(contributionSample());
  invalid.activity.volumes[0].recordId = invalid.records.find((r) => r.kind === 'issue')!.id;
  expect(() => validateContributionSource(invalid)).toThrow('Volume requires a primary-branch PR');
});

it('allows later qualifying evidence without changing the once-per-role final merged volume', () => {
  const source = structuredClone(contributionSample());
  source.activity.volumes.find((volume) => volume.role === 'reviewed')!.qualifiedAt =
    '2026-09-01T12:00:00.000Z';
  expect(selectContributions(source).additionalTotals['reviewed.linesChanged']).toEqual({
    status: 'complete',
    value: 920,
  });
});

it('rejects unknown volume records and non-primary or out-of-period merged-volume input', () => {
  const unknown = structuredClone(contributionSample());
  unknown.activity.volumes[0].recordId = 'unknown-record';
  expect(() => validateContributionSource(unknown)).toThrow('Unknown volume identity');
  const branch = structuredClone(contributionSample());
  const record = branch.records[0];
  if (record.kind !== 'pr') throw Error('Expected PR');
  record.baseBranch = 'release';
  branch.credits = branch.credits.filter(
    (credit) =>
      credit.recordId !== record.id ||
      !['authoredPrsMerged', 'mergesPerformed'].includes(credit.metric),
  );
  expect(() => validateContributionSource(branch)).toThrow('Volume requires a primary-branch PR');
  const outside = structuredClone(contributionSample());
  const current = structuredClone(
    contributionSample({ period: { kind: 'preset', preset: 'this-month' } }),
  );
  outside.period = current.period;
  outside.range = current.range;
  outside.credits = outside.credits.filter((credit) => credit.creditedAt >= current.range.start);
  outside.activity.comments = outside.activity.comments.filter(
    (comment) => comment.createdAt >= current.range.start,
  );
  expect(() => validateContributionSource(outside)).toThrow('Volume requires a primary-branch PR');
});
