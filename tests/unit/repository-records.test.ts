import { expect, it } from 'vitest';
import { repositoryRecordSample } from '@/mocks/repository-records';
import { repositorySample } from '@/mocks/current-records';
import { repositoryOverviewSamples, repositoryOverviewSample } from '@/mocks/repository-overview';
import { backlogMetricIds, agingThresholds } from '@/models/repository-overview';
import type { RecordSelection } from '@/models/repository-records';
import { recordListTitle, matchesCurrentPr } from '@/lib/presentation/repository-records';
import { recountActivity } from '../support/world-recount';

const samples = repositoryOverviewSamples();
const js = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
const load = (selection: RecordSelection) =>
  repositoryRecordSample(js, { selection, returnTo: '/repos?period=this-month&age=60' });
it('reconciles every current metric and age threshold against the overview across all 18 repositories', () => {
  for (const { repository, backlog } of samples.repositories) {
    const selections: RecordSelection[] = [
      ...backlogMetricIds.map((metric) => ({ scope: 'current' as const, metric })),
      ...agingThresholds.map((ageDays) => ({
        scope: 'current' as const,
        metric: 'agedPrs' as const,
        ageDays,
      })),
    ];
    for (const selection of selections) {
      const list = repositoryRecordSample(repository, { selection, returnTo: '/repos' });
      expect(list.rows.length, repository.name + '/' + selection.metric).toBe(
        list.measurement.value ?? 0,
      );
      expect(new Set(list.rows.map((row) => row.id)).size).toBe(list.rows.length);
      if (
        list.kind === 'prs' &&
        selection.metric !== 'totalOpenPrs' &&
        selection.metric !== 'draftPrs'
      )
        expect(list.rows.every((row) => !row.draft)).toBe(true);
    }
    expect(repositorySample(repository.id).issues.length).toBe(backlog.counts.openIssues.value);
  }
});
it('pins independently known cohorts and applies age/reviewer/approval filters to the same current PRs', () => {
  const { prs } = repositorySample(js.id);
  expect(prs.length).toBe(137);
  expect(prs.filter((row) => row.draft)).toHaveLength(17);
  expect(prs.filter((row) => !row.draft && row.ageDays > 60)).toHaveLength(60);
  expect(prs.filter((row) => !row.draft && row.humanReviewers === 0)).toHaveLength(39);
  expect(prs.filter((row) => !row.draft && row.approvals === 0)).toHaveLength(60);
  expect(prs.filter((row) => !row.draft && row.approvals === 3)).toHaveLength(1);
  expect(prs.filter((row) => row.agentReviewer)).toHaveLength(48);
  expect(prs.filter((row) => row.botReviewer)).toHaveLength(30);
  const aged = load({ scope: 'current', metric: 'agedPrs', ageDays: 60 });
  expect(aged.rows.map((row) => row.id)).toEqual(
    prs.filter((row) => !row.draft && row.ageDays > 60).map((row) => row.id),
  );
  const zero = load({ scope: 'current', metric: 'agedPrs', ageDays: 180 });
  expect(zero.measurement).toEqual({ status: 'complete', value: 0 });
  expect(zero.rows).toEqual([]);
  expect(
    matchesCurrentPr({ ...prs[0], state: 'Closed' }, { scope: 'current', metric: 'totalOpenPrs' }),
  ).toBe(false);
});
it('reconciles each prepared period count and constrains the relevant event date and merge branch', () => {
  for (const { repository } of samples.repositories)
    for (const prepared of samples.periods) {
      for (const metric of ['prsOpened', 'prsMerged', 'issuesOpened', 'issuesClosed'] as const) {
        const selection: RecordSelection = {
          scope: 'period',
          metric,
          range: prepared.period.range,
          ...(metric === 'prsMerged' ? { branch: repository.primaryBranch } : {}),
        };
        const list = repositoryRecordSample(repository, { selection, returnTo: '/repos' });
        expect(list.measurement, repository.name + '/' + metric).toEqual(
          prepared.rows[repository.id].activity.counts[metric],
        );
        expect(list.rows.length, repository.name + '/' + metric).toBe(list.measurement.value ?? 0);
        for (const row of list.rows) {
          const event =
            metric === 'prsMerged' && 'mergedAt' in row
              ? row.mergedAt
              : metric === 'issuesClosed' && 'closedAt' in row
                ? row.closedAt
                : row.createdAt;
          expect(event).not.toBeNull();
          expect(event! >= selection.range.start).toBe(true);
          expect(
            selection.range.endInclusive
              ? event! <= selection.range.end
              : event! < selection.range.end,
          ).toBe(true);
          if (metric === 'prsMerged' && 'baseBranch' in row) {
            expect(row.baseBranch).toBe(repository.primaryBranch);
            expect(row.state).toBe('Merged');
          }
        }
      }
    }
});
it('keeps period cohorts independent of current state and supports earlier-created closures and merges', () => {
  const report = repositoryOverviewSample({ kind: 'preset', preset: 'this-month' }, [js.id]);
  const range = report.period.range;
  const opened = load({ scope: 'period', metric: 'prsOpened', range });
  const merged = load({ scope: 'period', metric: 'prsMerged', range, branch: 'master' });
  const closed = load({ scope: 'period', metric: 'issuesClosed', range });
  const recount = recountActivity(js.id, range);
  expect(opened.rows).toHaveLength(recount.counts.prsOpened);
  expect(merged.rows).toHaveLength(recount.counts.prsMerged);
  expect(closed.rows).toHaveLength(recount.counts.issuesClosed);
  expect(opened.rows.some((row) => row.state === 'Merged')).toBe(true);
  expect(opened.rows.some((row) => row.state === 'Closed')).toBe(true);
  expect(merged.rows.some((row) => row.createdAt < range.start)).toBe(true);
  expect(closed.rows.some((row) => row.createdAt < range.start)).toBe(true);
  expect(
    new Set(
      [...opened.rows, ...merged.rows, ...closed.rows].map((row) => new URL(row.url).hostname),
    ),
  ).toEqual(new Set(['github.example']));
});
it('retains missing and partial coverage instead of claiming exact empty cohorts', () => {
  const agentRepo = samples.repositories.find(
    (row) => row.repository.slug === 'prebid-agent-skills',
  )!.repository;
  const unavailable = repositoryRecordSample(agentRepo, {
    selection: { scope: 'current', metric: 'humanApprovals0' },
    returnTo: '/repos',
  });
  expect(unavailable.measurement.status).toBe('missing');
  expect(unavailable.rows).toEqual([]);
  const partialRepo = samples.repositories.find(
    (row) => row.repository.slug === 'prebid-cache-java',
  )!.repository;
  const partial = repositoryRecordSample(partialRepo, {
    selection: { scope: 'current', metric: 'agentFeedbackPrs' },
    returnTo: '/repos',
  });
  expect(partial.measurement).toMatchObject({ status: 'partial', value: 2 });
  expect(partial.rows).toHaveLength(2);
  // The record set starts in 2024, so an earlier range has no prepared coverage.
  const unknown = load({
    scope: 'period',
    metric: 'prsOpened',
    range: {
      start: '2023-10-01T00:00:00.000Z',
      end: '2023-10-02T00:00:00.000Z',
      endInclusive: false,
    },
  });
  expect(unknown.measurement.status).toBe('missing');
  expect(unknown.rows).toEqual([]);
  expect(recordListTitle({ scope: 'current', metric: 'agedPrs', ageDays: 60 })).toBe(
    'PRs older than 60 days',
  );
});

it('excludes exact age boundaries, drafts, and unknown reviewer or approval counts', () => {
  const row = repositorySample(js.id).prs.find((entry) => !entry.draft)!;
  expect(
    matchesCurrentPr({ ...row, ageDays: 60 }, { scope: 'current', metric: 'agedPrs', ageDays: 60 }),
  ).toBe(false);
  expect(
    matchesCurrentPr({ ...row, ageDays: 61 }, { scope: 'current', metric: 'agedPrs', ageDays: 60 }),
  ).toBe(true);
  expect(
    matchesCurrentPr(
      { ...row, draft: true, ageDays: 61 },
      { scope: 'current', metric: 'agedPrs', ageDays: 60 },
    ),
  ).toBe(false);
  for (const metric of [
    'humanReviewers0',
    'humanReviewersMoreThan2',
    'humanApprovals0',
    'humanApprovalsMoreThan2',
  ] as const)
    expect(
      matchesCurrentPr(
        { ...row, humanReviewers: null, approvals: null },
        { scope: 'current', metric },
      ),
    ).toBe(false);
  expect(matchesCurrentPr(row, { scope: 'current', metric: 'openIssues' })).toBe(false);
});
