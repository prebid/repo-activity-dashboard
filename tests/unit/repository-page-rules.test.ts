import { expect, it } from 'vitest';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { repositoryPageSample } from '@/mocks/repository-page';
import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { repositoryPageFiltersSchema } from '@/models/repository-page';
import {
  requiresNonDraftPr,
  repositoryFilterError,
  withoutCurrentReviewFilters,
} from '@/lib/presentation/repository-page-rules';
const samples = repositoryOverviewSamples();
const actors = [
  ['lastAgent', 'agent'],
  ['lastBot', 'bot'],
  ['lastPrebidReviewer', 'prebid-reviewer'],
  ['lastContributor', 'contributor'],
  ['lastOtherHuman', 'other-human'],
  ['lastUnknown', 'unknown'],
] as const;
it.each(samples.repositories)(
  'matches every current latest-actor summary from the direct filter: $repository.slug',
  ({ repository }) => {
    const source = repositoryPageSample(repository, {
      selection: { scope: 'current', metric: 'totalOpenPrs' },
      returnTo: '/repos',
    });
    for (const [metric, actor] of actors) {
      const summary = repositoryPageSample(repository, {
        selection: { scope: 'current', metric },
        returnTo: '/repos',
      });
      const filtered = selectRepositoryPage(source, { kind: 'prs', latestActors: [actor] });
      expect(filtered.measurement).toEqual(summary.measurement);
      expect(filtered.rows.map((row) => row.id)).toEqual(summary.rows.map((row) => row.id));
      expect(filtered.rows.every((row) => 'draft' in row && !row.draft)).toBe(true);
    }
  },
);
it('keeps known Unknown classification separate from unavailable activity metadata', () => {
  const source = repositoryPageSample(samples.repositories[0].repository, {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  if (source.kind !== 'prs') throw Error('Expected PRs');
  const known = selectRepositoryPage(source, { kind: 'prs', latestActors: ['unknown'] });
  expect(known.measurement).toEqual({ status: 'complete', value: 1 });
  expect(known.rows[0].latestActivity).toMatchObject({ category: 'unknown', account: null });
  expect(
    selectRepositoryPage(source, { kind: 'prs', latestActors: ['contributor'] }).measurement,
  ).toEqual({ status: 'complete', value: 52 });
  const unavailable = {
    ...source,
    rows: source.rows.map((row) =>
      row.latestActor === 'unknown' ? { ...row, latestActivity: null } : row,
    ),
  };
  expect(
    selectRepositoryPage(unavailable, { kind: 'prs', latestActors: ['unknown'] }).measurement,
  ).toMatchObject({ status: 'partial', value: 0 });
  expect(
    selectRepositoryPage(unavailable, { kind: 'prs', latestActors: ['agent'] }).measurement,
  ).toMatchObject({ status: 'partial', value: 18 });
});
it('does not turn non-draft eligibility into a new ban on period or issue activity filters', () => {
  const filters = repositoryPageFiltersSchema.parse({ kind: 'prs', latestActors: ['agent'] });
  const selection = {
    scope: 'period' as const,
    metric: 'prsOpened' as const,
    range: samples.periods[0].period.range,
  };
  expect(repositoryFilterError(filters, selection)).toBeUndefined();
  expect(requiresNonDraftPr(filters, selection)).toBe(false);
  expect(requiresNonDraftPr(filters, { scope: 'current', metric: 'totalOpenPrs' })).toBe(true);
  const issues = repositoryPageFiltersSchema.parse({
    kind: 'issues',
    latestActors: ['contributor'],
  });
  expect(requiresNonDraftPr(issues, { scope: 'current', metric: 'openIssues' })).toBe(false);
  expect(withoutCurrentReviewFilters(issues)).toEqual(issues);
  expect(
    withoutCurrentReviewFilters(
      repositoryPageFiltersSchema.parse({
        kind: 'prs',
        latestActors: ['agent'],
        approvals: '1',
        reviewers: '0',
        agentReviewer: 'yes',
        botReviewer: 'no',
      }),
    ),
  ).toMatchObject({
    latestActors: ['agent'],
    approvals: undefined,
    reviewers: undefined,
    agentReviewer: undefined,
    botReviewer: undefined,
  });
});
