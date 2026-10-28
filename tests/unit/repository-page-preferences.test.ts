import { expect, it } from 'vitest';
import {
  repositoryColumnDefaults,
  repositoryColumnsKey,
  readRepositoryColumns,
  serializeRepositoryColumns,
  resolveRepositoryColumns,
  writeRepositoryColumns,
} from '@/lib/presentation/repository-page-preferences';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
const repo = repositoryOverviewSamples().repositories[0].repository;
const source = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'totalOpenPrs' },
  returnTo: '/repos',
});
it('uses contextual defaults without conflating reviewers and approvals', () => {
  expect(repositoryColumnDefaults(source)).toMatchObject({
    ageDays: true,
    humanReviewers: true,
    approvals: true,
    createdAt: false,
    labels: false,
  });
  for (const metric of [
    'humanReviewers1',
    'humanApprovals1',
    'agentFeedbackPrs',
    'botFeedbackPrs',
    'openIssues',
  ] as const) {
    const defaults = repositoryColumnDefaults({
      ...source,
      drilldown: { ...source.drilldown, selection: { scope: 'current', metric } },
    });
    expect(defaults.humanReviewers).toBe(metric === 'humanReviewers1');
    expect(defaults.approvals).toBe(metric === 'humanApprovals1');
    expect(defaults.agentReviewer).toBe(metric === 'agentFeedbackPrs');
    expect(defaults.botReviewer).toBe(metric === 'botFeedbackPrs');
  }
  for (const metric of ['prsMerged', 'issuesClosed'] as const) {
    const defaults = repositoryColumnDefaults({
      ...source,
      drilldown: {
        ...source.drilldown,
        selection: {
          scope: 'period',
          metric,
          range: { start: '2026-10-01T00:00:00.000Z', end: source.asOf, endInclusive: true },
        },
      },
    });
    expect(defaults.createdAt).toBe(true);
    expect(defaults.ageDays).toBe(false);
    expect(defaults.mergedAt).toBe(metric === 'prsMerged');
    expect(defaults.closedAt).toBe(metric === 'issuesClosed');
  }
});
it('ignores corrupt or retired preferences and isolates account, repository and tab keys', () => {
  for (const raw of [
    null,
    '{',
    'null',
    '[]',
    '{}',
    '{"version":2,"columns":{}}',
    '{"version":1,"columns":[]}',
    '{"version":1,"columns":null}',
    '{"version":1,"columns":4}',
  ])
    expect(readRepositoryColumns(raw, ['ageDays'])).toEqual({});
  expect(
    readRepositoryColumns(serializeRepositoryColumns({ ageDays: false, retired: true }), [
      'ageDays',
    ]),
  ).toEqual({ ageDays: false });
  expect(readRepositoryColumns('{"version":1,"columns":{"ageDays":"yes"}}', ['ageDays'])).toEqual(
    {},
  );
  expect(
    new Set([
      repositoryColumnsKey('alice', 'one', 'prs'),
      repositoryColumnsKey('bob', 'one', 'prs'),
      repositoryColumnsKey('alice', 'two', 'prs'),
      repositoryColumnsKey('alice', 'one', 'issues'),
    ]).size,
  ).toBe(4);
});
it('gives URL columns precedence, including an explicit empty list, while retaining other state', () => {
  const defaults = { ageDays: true, labels: false },
    saved = { ageDays: false },
    ids = ['ageDays', 'createdAt'];
  expect(resolveRepositoryColumns('', 'prs', defaults, saved, ids)).toEqual({
    ...defaults,
    ...saved,
  });
  const search = writeRepositoryColumns(
    'prs.page=2&prs.columns=retired',
    'prs',
    { ageDays: true, createdAt: false },
    ids,
  );
  expect(new URLSearchParams(search).get('prs.page')).toBe('2');
  expect(resolveRepositoryColumns(search, 'prs', defaults, saved, ids)).toEqual({
    ageDays: true,
    createdAt: false,
    labels: false,
  });
  expect(
    resolveRepositoryColumns(
      writeRepositoryColumns('', 'prs', { ageDays: false, createdAt: false }, ids),
      'prs',
      defaults,
      {},
      ids,
    ),
  ).toEqual({ ageDays: false, createdAt: false, labels: false });
});
