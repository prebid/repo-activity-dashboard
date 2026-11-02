import { expect, it } from 'vitest';
import {
  drilldownPresentation,
  mergeValues,
  recordColumnChoices,
  recordColumnField,
  recordMenuColumnIds,
  sortToken,
} from '@/lib/presentation/repository-url';
import { repositoryColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { recordColumnTable } from '@/lib/presentation/url/defaults';
import {
  repositoryInlineColumnIds,
  repositoryPageIssueColumns,
  repositoryPagePrColumns,
} from '@/features/repositories/repository-page-columns';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';

const range = {
  start: '2026-10-01T00:00:00.000Z',
  end: '2026-10-24T12:00:00.000Z',
  endInclusive: true,
};
const saved = {
  prs: {
    sort: { sort: 'title', descending: false },
    presentation: { columns: { labels: true, ageDays: false, author: false }, chartsVisible: true },
  },
  issues: { sort: { sort: 'retired', descending: true }, presentation: null },
  authors: { sort: 'account', descending: false },
  mergedPrs: { sort: 'mergedAt', descending: true },
  credits: { sort: 'createdAt', descending: true },
};

it('merges a patch over values, removing the fields it leaves undefined', () => {
  expect(mergeValues({ a: '1', b: ['x'], c: true }, { a: undefined, c: '2', d: ['y'] })).toEqual({
    b: ['x'],
    c: '2',
    d: ['y'],
  });
  expect(sortToken({ sort: 'title', descending: true })).toBe('-title');
  expect(sortToken({ sort: 'title', descending: false })).toBe('title');
  expect(sortToken({ sort: '', descending: true })).toBeUndefined();
  expect(sortToken(null)).toBeUndefined();
});
it('lists exactly the record columns the Columns menu offers', () => {
  const menu = (columns: typeof repositoryPagePrColumns | typeof repositoryPageIssueColumns) =>
    columns
      .filter((column) => column.hideable !== false && !repositoryInlineColumnIds.has(column.id))
      .map((column) => column.id);
  expect(recordMenuColumnIds('prs')).toEqual(menu(repositoryPagePrColumns));
  expect(recordMenuColumnIds('issues')).toEqual(menu(repositoryPageIssueColumns));
});
it('reads and writes the Columns menu choices as a diff against the v1 columns', () => {
  const table = recordColumnTable('prs', 'totalOpenPrs');
  const repo = repositoryOverviewSamples().repositories[0].repository;
  const source = repositoryPageSample(repo, {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  // The v1 table and the record page's own defaults agree.
  const defaults = repositoryColumnDefaults(source);
  expect(recordColumnChoices(table, undefined)).toEqual(
    Object.fromEntries(recordMenuColumnIds('prs').map((id) => [id, defaults[id] !== false])),
  );
  const choices = { ...recordColumnChoices(table, undefined), labels: true, author: false };
  expect(recordColumnField(table, choices)).toEqual(['-author']);
  expect(recordColumnField(table, { createdAt: true })).toEqual(['createdAt']);
  expect(recordColumnField(table, {})).toBeUndefined();
  expect(recordColumnChoices(table, ['-author', 'createdAt'])).toMatchObject({
    author: false,
    createdAt: true,
  });
  expect(recordColumnChoices(table, ['retired'])).toBeNull();
});
it('carries the viewer’s saved choices into links that open lists and insights', () => {
  expect(drilldownPresentation({ scope: 'current', metric: 'totalOpenPrs' }, undefined)).toEqual(
    {},
  );
  // Saved overrides apply only to the target table's menu columns.
  expect(drilldownPresentation({ scope: 'current', metric: 'totalOpenPrs' }, saved)).toEqual({
    sort: 'title',
    cols: ['-author', '-ageDays'],
    charts: true,
  });
  expect(
    drilldownPresentation({ scope: 'period', metric: 'prsOpened', range }, saved, true),
  ).toEqual({ sort: 'title', charts: true });
  // A saved sort on a column the table lacks does not apply.
  expect(drilldownPresentation({ scope: 'current', metric: 'openIssues' }, saved)).toEqual({});
  expect(drilldownPresentation({ scope: 'period', metric: 'prAuthors', range }, saved)).toEqual({
    sort: 'account',
  });
  expect(
    drilldownPresentation(
      { scope: 'period', metric: 'medianMergeDays', range, branch: 'master' },
      saved,
    ),
  ).toEqual({ sort: '-mergedAt' });
  expect(
    drilldownPresentation({ scope: 'period', metric: 'agentFeedbackCredits', range }, saved),
  ).toEqual({});
  expect(
    drilldownPresentation(
      { scope: 'period', metric: 'botApprovalCredits', range },
      {
        credits: { sort: 'firstCreditAt', descending: false },
      },
    ),
  ).toEqual({ sort: 'firstCreditAt' });
});
