import { describe, expect, it, vi } from 'vitest';
import { repositoryCatalog } from '@/config/repositories';
import { absoluteChange } from '@/lib/presentation/measurement';
import {
  repositoryOverviewSample,
  customSampleSelection,
  overviewAsOf,
} from '@/mocks/repository-overview';
import { periodPresets } from '@/models/reporting-period';
import {
  activitySchema,
  agingThresholds,
  agingThresholdSchema,
  backlogSchema,
  countSchema,
  durationSchema,
  defaultAgingThreshold,
} from '@/models/repository-overview';

describe('overview display measurements', () => {
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '0', null])(
    'rejects invalid complete count %s',
    (value) => {
      expect(countSchema.safeParse({ status: 'complete', value }).success).toBe(false);
    },
  );
  it('keeps complete zero, partial, missing and not-applicable distinct', () => {
    expect(countSchema.parse({ status: 'complete', value: 0 })).toEqual({
      status: 'complete',
      value: 0,
    });
    expect(
      countSchema.parse({ status: 'partial', value: 2, reason: 'Incomplete sample' }).status,
    ).toBe('partial');
    expect(
      countSchema.parse({ status: 'missing', value: null, reason: 'No history' }).value,
    ).toBeNull();
    expect(
      durationSchema.parse({ status: 'not-applicable', value: null, reason: 'No merges' }).status,
    ).toBe('not-applicable');
    expect(durationSchema.parse({ status: 'complete', value: 5.5 }).value).toBe(5.5);
    expect(
      countSchema.safeParse({ status: 'missing', value: 0, reason: 'No history' }).success,
    ).toBe(false);
    expect(countSchema.safeParse({ status: 'partial', value: 2, reason: ' ' }).success).toBe(false);
    expect(durationSchema.safeParse({ status: 'complete', value: Infinity }).success).toBe(false);
  });
  it('calculates neutral absolute changes only from complete operands', () => {
    expect(absoluteChange({ status: 'complete', value: 7 }, { status: 'complete', value: 0 })).toBe(
      7,
    );
    expect(absoluteChange({ status: 'complete', value: 4 }, { status: 'complete', value: 9 })).toBe(
      -5,
    );
    expect(absoluteChange({ status: 'complete', value: 0 }, { status: 'complete', value: 0 })).toBe(
      0,
    );
    expect(
      absoluteChange(
        { status: 'partial', value: 2, reason: 'Partial' },
        { status: 'complete', value: 3 },
      ),
    ).toBeNull();
    expect(
      absoluteChange(
        { status: 'complete', value: 3 },
        { status: 'missing', value: null, reason: 'No baseline' },
      ),
    ).toBeNull();
  });
});

describe('prepared All Repositories samples', () => {
  it('uses all 18 catalog identities, a fixed clock, and the agreed initial choices', () => {
    const sample = repositoryOverviewSample();
    expect(sample.source).toBe('sample');
    expect(sample.asOf).toBe('2026-10-24T12:00:00.000Z');
    expect(sample.activitySample).toBe('prepared');
    expect(sample.period.selection).toEqual({ kind: 'preset', preset: 'this-month' });
    expect(sample.rows).toHaveLength(18);
    expect(new Set(sample.rows.map((row) => row.repository.id)).size).toBe(18);
    expect(sample.rows.map((row) => row.repository.id)).toEqual(
      repositoryCatalog.map((repo) => repo.id),
    );
    expect(sample.rows[0].repository).toEqual({
      id: 'repo-prebidjs',
      name: 'Prebid.js',
      slug: 'prebidjs',
      primaryBranch: 'master',
    });
    expect(
      sample.rows.find((row) => row.repository.id === 'repo-repo-activity-dashboard')?.repository,
    ).toMatchObject({ name: 'Repository Activity Dashboard', primaryBranch: 'main' });
    expect(defaultAgingThreshold).toBe(30);
    expect(agingThresholds).toEqual([30, 60, 90, 120, 180, 360]);
    expect(agingThresholdSchema.safeParse(31).success).toBe(false);
  });
  it('pins independently specified backlog, feedback, approval and activity answers', () => {
    const row = repositoryOverviewSample().rows[0];
    const counts = Object.fromEntries(
      Object.entries(row.backlog.counts).map(([key, metric]) => [key, metric.value]),
    );
    expect(counts).toEqual({
      totalOpenPrs: 137,
      draftPrs: 17,
      nonDraftPrs: 120,
      openIssues: 834,
      humanReviewers0: 39,
      humanReviewers1: 40,
      humanReviewers2: 40,
      humanReviewersMoreThan2: 1,
      humanApprovals0: 60,
      humanApprovals1: 40,
      humanApprovals2: 19,
      humanApprovalsMoreThan2: 1,
      agentFeedbackPrs: 48,
      botFeedbackPrs: 30,
      lastAgent: 18,
      lastBot: 12,
      lastPrebidReviewer: 36,
      lastContributor: 52,
      lastOtherHuman: 1,
      lastUnknown: 1,
    });
    expect(Object.values(row.backlog.agedPrs).map((metric) => metric.value)).toEqual([
      90, 60, 30, 0, 0, 0,
    ]);
    expect(
      Object.fromEntries(
        Object.entries(row.activity.counts).map(([key, metric]) => [key, metric.value]),
      ),
    ).toEqual({
      prsOpened: 47,
      prsMerged: 38,
      issuesOpened: 58,
      issuesClosed: 46,
      prAuthors: 24,
      issueAuthors: 39,
      agentFeedbackCredits: 18,
      agentApprovalCredits: 9,
      botFeedbackCredits: 11,
      botApprovalCredits: 4,
    });
    expect(row.activity.mergeDuration).toEqual({
      days: { status: 'complete', value: 5.5 },
      sampleSize: { status: 'complete', value: 38 },
    });
    expect(absoluteChange(row.activity.counts.prsOpened, row.comparison.counts.prsOpened)).toBe(3);
  });
  it.each(periodPresets)(
    'supplies a structurally valid sample for %s without changing backlog',
    (preset) => {
      const sample = repositoryOverviewSample({ kind: 'preset', preset });
      expect(sample.rows).toHaveLength(18);
      expect(sample.activitySample).toBe('prepared');
      expect(sample.rows.map((row) => row.backlog)).toEqual(
        repositoryOverviewSample().rows.map((row) => row.backlog),
      );
      for (const row of sample.rows) {
        expect(backlogSchema.safeParse(row.backlog).success).toBe(true);
        expect(activitySchema.safeParse(row.activity).success).toBe(true);
        expect(activitySchema.safeParse(row.comparison).success).toBe(true);
        for (const activity of [row.activity, row.comparison]) {
          const counts = activity.counts;
          if (counts.prAuthors.status === 'complete' && counts.prsOpened.status === 'complete')
            expect(counts.prAuthors.value).toBeLessThanOrEqual(counts.prsOpened.value);
          if (
            counts.issueAuthors.status === 'complete' &&
            counts.issuesOpened.status === 'complete'
          )
            expect(counts.issueAuthors.value).toBeLessThanOrEqual(counts.issuesOpened.value);
          if (counts.prsMerged.status === 'complete') {
            expect(activity.mergeDuration.sampleSize.value).toBe(counts.prsMerged.value);
            expect(activity.mergeDuration.days.status).toBe(
              counts.prsMerged.value ? 'complete' : 'not-applicable',
            );
          }
        }
      }
    },
  );
  it('supplies distinct periods and keeps matching year-to-date windows consistent', () => {
    expect(
      periodPresets.map(
        (preset) =>
          repositoryOverviewSample({ kind: 'preset', preset }).rows[0].activity.counts.prsOpened
            .value,
      ),
    ).toEqual([12, 15, 47, 61, 529, 491, 620]);
    expect(
      repositoryOverviewSample({ kind: 'preset', preset: 'this-year' }).rows[0].comparison,
    ).toEqual(
      repositoryOverviewSample({ kind: 'preset', preset: 'last-year-to-date' }).rows[0].activity,
    );
  });
  it('keeps additive activity within the enclosing month, including quiet samples', () => {
    const month = repositoryOverviewSample();
    const week = repositoryOverviewSample({ kind: 'preset', preset: 'this-week' });
    const lastWeek = repositoryOverviewSample({ kind: 'preset', preset: 'last-week' });
    for (let i = 0; i < month.rows.length; i++) {
      // These two disjoint weeks are both inside the selected October period.
      for (const metric of [
        'prsOpened',
        'prsMerged',
        'issuesOpened',
        'agentFeedbackCredits',
        'agentApprovalCredits',
        'botFeedbackCredits',
        'botApprovalCredits',
      ] as const) {
        const a = week.rows[i].activity.counts[metric];
        const b = lastWeek.rows[i].activity.counts[metric];
        const total = month.rows[i].activity.counts[metric];
        expect(a.status).toBe('complete');
        expect(b.status).toBe('complete');
        expect(Number(a.value) + Number(b.value)).toBeLessThanOrEqual(Number(total.value));
      }
    }
  });
  it('requires every defined metric and rejects misspelled or extra values', () => {
    const row = repositoryOverviewSample().rows[0];
    const incomplete = structuredClone(row.activity);
    Reflect.deleteProperty(incomplete.counts, 'prsOpened');
    expect(activitySchema.safeParse(incomplete).success).toBe(false);
    expect(
      activitySchema.safeParse({
        ...row.activity,
        counts: { ...row.activity.counts, prsClosed: { status: 'complete', value: 1 } },
      }).success,
    ).toBe(false);
    const invalidAge = structuredClone(row.backlog);
    Reflect.deleteProperty(invalidAge.agedPrs, '30');
    expect(backlogSchema.safeParse(invalidAge).success).toBe(false);
  });
  it('keeps backlog arithmetic, independent distributions, and aging thresholds coherent', () => {
    for (const { backlog } of repositoryOverviewSample().rows) {
      const c = backlog.counts;
      expect(c.totalOpenPrs.value).toBe(Number(c.draftPrs.value) + Number(c.nonDraftPrs.value));
      for (const buckets of [
        [c.humanReviewers0, c.humanReviewers1, c.humanReviewers2, c.humanReviewersMoreThan2],
        [c.humanApprovals0, c.humanApprovals1, c.humanApprovals2, c.humanApprovalsMoreThan2],
        [
          c.lastAgent,
          c.lastBot,
          c.lastPrebidReviewer,
          c.lastContributor,
          c.lastOtherHuman,
          c.lastUnknown,
        ],
      ]) {
        if (buckets.every((metric) => metric.status === 'complete'))
          expect(buckets.reduce((sum, metric) => sum + Number(metric.value), 0)).toBe(
            c.nonDraftPrs.value,
          );
      }
      let maximum = Number(c.nonDraftPrs.value);
      for (const threshold of agingThresholds) {
        const value = backlog.agedPrs[threshold].value;
        expect(value).not.toBeNull();
        expect(value).toBeLessThanOrEqual(maximum);
        maximum = Number(value);
      }
      expect(c.agentFeedbackPrs.value).toBeLessThanOrEqual(Number(c.nonDraftPrs.value));
      expect(c.botFeedbackPrs.value).toBeLessThanOrEqual(Number(c.nonDraftPrs.value));
    }
  });
  it('includes large, quiet, empty, partial and unavailable cases without claiming missing means zero', () => {
    const rows = repositoryOverviewSample().rows;
    expect(
      rows.find((row) => row.repository.id === 'repo-prebiddocs')?.backlog.counts.openIssues.value,
    ).toBe(12345);
    const empty = rows.find((row) => row.repository.id === 'repo-prebid-mobile-ios-sdk');
    expect(empty?.backlog.counts.totalOpenPrs).toEqual({ status: 'complete', value: 0 });
    expect(empty?.activity.mergeDuration.days.status).toBe('not-applicable');
    expect(
      rows.find((row) => row.repository.id === 'repo-go-gdpr')?.activity.counts.prsOpened.value,
    ).toBe(1);
    expect(
      rows.find((row) => row.repository.id === 'repo-prebid-agent-skills')?.backlog.counts
        .humanApprovals0,
    ).toMatchObject({ status: 'missing', value: null });
    const partial = rows.find((row) => row.repository.id === 'repo-prebid-cache-java');
    expect(partial?.backlog.counts.agentFeedbackPrs).toMatchObject({ status: 'partial', value: 2 });
    expect(partial?.activity.counts.issuesClosed.status).toBe('partial');
    const unknown = rows.find((row) => row.repository.id === 'repo-github-activity-db');
    expect(unknown?.comparison.counts.prsOpened).toMatchObject({ status: 'missing', value: null });
  });
  it('respects empty/subset selections and rejects unknown catalog IDs', () => {
    expect(repositoryOverviewSample(undefined, []).rows).toEqual([]);
    expect(
      repositoryOverviewSample(undefined, ['repo-salesagent', 'repo-salesagent']).rows.map(
        (row) => row.repository.id,
      ),
    ).toEqual(['repo-salesagent']);
    expect(() => repositoryOverviewSample(undefined, ['missing'])).toThrow(
      'Unknown sample repository',
    );
  });
  it('supports the prepared custom range and explicitly marks any unprepared range', () => {
    const prepared = repositoryOverviewSample(customSampleSelection);
    expect(prepared.activitySample).toBe('prepared');
    expect(prepared.rows[0].activity.counts.prsOpened.value).toBe(7);
    expect(prepared.rows[0].comparison.counts.prsOpened).toEqual({ status: 'complete', value: 0 });
    const unprepared = repositoryOverviewSample({
      kind: 'custom',
      from: '2026-10-01',
      through: '2026-10-02',
    });
    expect(unprepared.activitySample).toBe('unprepared');
    expect(unprepared.rows.map((row) => row.backlog)).toEqual(
      prepared.rows.map((row) => row.backlog),
    );
    for (const row of unprepared.rows) {
      expect(row.activity.counts.prsOpened).toMatchObject({ status: 'missing', value: null });
      expect(row.comparison.counts.prsOpened).toMatchObject({ status: 'missing', value: null });
    }
  });
  it('returns fresh serializable values independent of the wall clock and prior caller mutations', () => {
    const initial = repositoryOverviewSample();
    const snapshot: unknown = JSON.parse(JSON.stringify(initial));
    initial.rows[0].backlog.counts.totalOpenPrs.value = 999;
    initial.rows[0].activity.counts.prsOpened.value = 999;
    initial.rows[0].repository.name = 'changed';
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2040-01-01T00:00:00Z'));
      expect(repositoryOverviewSample()).toEqual(snapshot);
      expect(repositoryOverviewSample().asOf).toBe(overviewAsOf);
    } finally {
      vi.useRealTimers();
    }
  });
});
