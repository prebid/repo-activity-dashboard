import { expect, it, vi } from 'vitest';
import { withOverviewSort } from '@/lib/presentation/overview-sort';
import { initialTableQuery, type TableController } from '@/lib/presentation/table-controller';
import type { OverviewSettings } from '@/models/overview-settings';

const settings: OverviewSettings = {
  repositoryIds: [],
  periods: [{ kind: 'preset', preset: 'this-month' }],
  ageThresholds: [30],
  backlogColumns: ['name', 'totalOpenPrs', 'nonDraftPrs', 'openIssues'],
  activityColumns: ['name', 'prsOpened', 'prsMerged', 'prAuthors'],
};
function controller(sort = '', descending = false): TableController {
  const query = { ...initialTableQuery, sort, descending };
  return {
    scopeKey: 'test',
    query,
    draftSearch: '',
    setSearch: vi.fn(),
    update: vi.fn(),
    flushSearch: () => query,
    reconcilePage: vi.fn(),
  };
}
it('defaults to the highest total backlog and created PR activity', () => {
  expect(withOverviewSort(controller(), 'backlog', settings).query).toMatchObject({
    sort: 'totalOpenPrs',
    descending: true,
  });
  expect(withOverviewSort(controller(), 'activity', settings).query).toMatchObject({
    sort: 'prsOpened',
    descending: true,
  });
});
it('uses Open or Merged when the primary metric is hidden, then repository name', () => {
  expect(
    withOverviewSort(controller('totalOpenPrs'), 'backlog', {
      ...settings,
      backlogColumns: ['name', 'nonDraftPrs'],
    }).query,
  ).toMatchObject({ sort: 'nonDraftPrs', descending: true });
  expect(
    withOverviewSort(controller('prsOpened'), 'activity', {
      ...settings,
      activityColumns: ['name', 'prsMerged'],
    }).query,
  ).toMatchObject({ sort: 'prsMerged', descending: true });
  expect(
    withOverviewSort(controller(), 'backlog', {
      ...settings,
      backlogColumns: ['name', 'openIssues'],
    }).query,
  ).toMatchObject({ sort: 'name', descending: false });
  expect(
    withOverviewSort(controller(), 'activity', {
      ...settings,
      activityColumns: ['name', 'prAuthors'],
    }).query,
  ).toMatchObject({ sort: 'name', descending: false });
});
it('preserves visible manual, URL, or saved sorts in either direction', () => {
  for (const descending of [true, false]) {
    const chosen = controller('openIssues', descending);
    expect(withOverviewSort(chosen, 'backlog', settings).query).toBe(chosen.query);
  }
  expect(withOverviewSort(controller('name'), 'activity', settings).query.sort).toBe('name');
});
it('keeps an age sort only while its threshold is selected', () => {
  expect(withOverviewSort(controller('agedPrs30'), 'backlog', settings).query.sort).toBe(
    'agedPrs30',
  );
  expect(
    withOverviewSort(controller('agedPrs30'), 'backlog', {
      ...settings,
      ageThresholds: [],
    }).query.sort,
  ).toBe('totalOpenPrs');
});
it('captures the effective sort without writing preferences or discarding flushed search', () => {
  const source = controller('prsOpened');
  source.flushSearch = () => ({ ...source.query, search: 'latest', page: 2 });
  const table = withOverviewSort(source, 'activity', {
    ...settings,
    activityColumns: ['prsMerged'],
  });
  expect(table.flushSearch()).toEqual({
    search: 'latest',
    page: 2,
    sort: 'prsMerged',
    descending: true,
  });
  expect(source.update).not.toHaveBeenCalled();
  expect(source.query.sort).toBe('prsOpened');
});
it('carries the fallback into page updates while allowing a new explicit sort', () => {
  const source = controller();
  const table = withOverviewSort(source, 'backlog', settings);
  table.update({ page: 2 });
  expect(source.update).toHaveBeenLastCalledWith({
    page: 2,
    sort: 'totalOpenPrs',
    descending: true,
  });
  table.update({ sort: 'openIssues', descending: false, page: 1 });
  expect(source.update).toHaveBeenLastCalledWith({
    page: 1,
    sort: 'openIssues',
    descending: false,
  });
});
