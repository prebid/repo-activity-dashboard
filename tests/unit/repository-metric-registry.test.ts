import { expect, it } from 'vitest';
import {
  repositoryTimelineMetricIds,
  repositoryTimelineMetricScope,
} from '@/models/repository-timeline';
import { reportMetricIds } from '@/models/contribution-metrics';
import { timelineMetricLabel, timelineMetricUnit } from '@/lib/presentation/timeline-metric-label';
import { repositoryTimelineSnapshotSelection } from '@/lib/presentation/repository-timeline';
import { repositoryRecordColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { repositoryMetricText } from '@/lib/presentation/repository-metric-text';
import { repositoryTimelineMetricDefinitions } from '@/features/repositories/repository-timeline-columns';
import { activityColumns, backlogColumns } from '@/features/repositories/overview-columns';

it('names and measures every repository Timeline metric from one registry', () => {
  const definitions = repositoryTimelineMetricDefinitions(repositoryTimelineMetricIds);
  const summary = [...activityColumns(), ...backlogColumns()];
  for (const definition of definitions) {
    const column = summary.find((row) => row.id === definition.id)!;
    expect([definition.group, definition.label]).toEqual([column.group, column.label]);
    expect(timelineMetricLabel(definition.id)).toBe(definition.group + ' — ' + definition.label);
    expect(timelineMetricUnit(definition.id)).toBe(definition.unit);
    expect(definition.unit).toBe(repositoryTimelineMetricScope(definition.id as never).unit);
  }
  expect(timelineMetricLabel('totalOpenPrs')).toBe('Pull requests — Total PRs');
  expect(timelineMetricLabel('nonDraftPrs')).toBe('Pull requests — Open');
  expect(timelineMetricLabel('medianMergeDays')).toBe('Duration — Median merge time');
  expect(timelineMetricUnit('medianMergeDays')).toBe('days');
  expect(timelineMetricUnit('agedPrs30')).toBe('count');
  for (const id of reportMetricIds) expect(timelineMetricUnit(id, true)).toBe('count');
  expect(() => timelineMetricLabel('bad', true)).toThrow();
  expect(() => timelineMetricUnit('bad', true)).toThrow();
  expect(() => repositoryMetricText('bad')).toThrow('Unknown repository metric');
});
it('dates and counts activity metrics by their registered basis', () => {
  expect(
    repositoryTimelineMetricIds
      .filter((id) => repositoryTimelineMetricScope(id).family === 'activity')
      .map((id) => [
        id,
        repositoryTimelineMetricScope(id).basis,
        repositoryTimelineMetricScope(id).eventDate,
      ]),
  ).toEqual([
    ['prsOpened', 'event', 'createdAt'],
    ['prsMerged', 'event', 'mergedAt'],
    ['prAuthors', 'distinct-authors', 'createdAt'],
    ['medianMergeDays', 'duration', 'mergedAt'],
    ['issuesOpened', 'event', 'createdAt'],
    ['issuesClosed', 'event', 'closedAt'],
    ['issueAuthors', 'distinct-authors', 'createdAt'],
  ]);
});
it('maps snapshot metrics to the current-state selection they apply at a cutoff', () => {
  expect(repositoryTimelineSnapshotSelection('agedPrs30')).toEqual({
    scope: 'current',
    metric: 'agedPrs',
    ageDays: 30,
  });
  expect(repositoryTimelineSnapshotSelection('totalOpenPrs')).toEqual({
    scope: 'current',
    metric: 'totalOpenPrs',
  });
});
it('sets record column defaults per selection', () => {
  expect(repositoryRecordColumnDefaults({ scope: 'current', metric: 'lastBot' })).toMatchObject({
    latestActor: true,
    ageDays: true,
    labels: false,
  });
  expect(
    repositoryRecordColumnDefaults({ scope: 'period', metric: 'medianMergeDays' }),
  ).toMatchObject({
    mergedAt: true,
    mergeDays: true,
    baseBranch: true,
    createdAt: true,
    latestActor: false,
  });
});
