import { describe, expect, it } from 'vitest';
import {
  changesOverviewScope,
  defaultOverviewSettings,
  normalizeOverviewSettings,
  overviewPreferenceKey,
  readOverviewPreferences,
  resetOverviewQuery,
  resolveOverviewSettings,
  serializeOverviewPreferences,
  writeOverviewSettings,
} from '@/lib/presentation/overview-settings';
import { readSavedTableSort, tableLocationStamp } from '@/lib/presentation/table-query';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { selectOverviewSample } from '@/lib/presentation/overview-samples';

const definition = {
  repositoryIds: ['a', 'b'],
  backlogColumns: ['name', 'total', 'age'],
  activityColumns: ['name', 'opened', 'merged'],
  defaultBacklogColumns: ['name', 'total'],
  defaultActivityColumns: ['name', 'opened'],
};
const asOf = '2026-10-24T12:00:00.000Z';
const defaults = defaultOverviewSettings(definition);
describe('overview settings contracts', () => {
  it('keeps explicit URL values above saved values and saved values above defaults', () => {
    const saved = {
      ...defaults,
      repositoryIds: ['b'],
      ageDays: 90 as const,
      showChange: true,
      period: { kind: 'preset' as const, preset: 'last-week' as const },
    };
    expect(resolveOverviewSettings('', null, definition, asOf).value).toEqual(defaults);
    expect(resolveOverviewSettings('', saved, definition, asOf).value).toEqual(saved);
    expect(
      resolveOverviewSettings('repo=a&age=60&change=0&period=this-year', saved, definition, asOf)
        .value,
    ).toMatchObject({
      repositoryIds: ['a'],
      ageDays: 60,
      showChange: false,
      period: { kind: 'preset', preset: 'this-year' },
    });
  });
  it('preserves empty selections and normalizes duplicates, retired identities and columns', () => {
    expect(
      resolveOverviewSettings(Array(300).fill('repo=a').join('&'), null, definition, asOf).value
        .repositoryIds,
    ).toEqual(['a']);
    expect(
      resolveOverviewSettings('repo=', defaults, definition, asOf).value.repositoryIds,
    ).toEqual([]);
    expect(
      resolveOverviewSettings('repo=retired', defaults, definition, asOf).value.repositoryIds,
    ).toEqual([]);
    const normalized = normalizeOverviewSettings(
      {
        ...defaults,
        repositoryIds: ['b', 'b', 'retired'],
        backlogColumns: ['age', 'retired'],
        activityColumns: [],
      },
      definition,
      asOf,
    );
    expect(normalized).toMatchObject({
      repositoryIds: ['b'],
      backlogColumns: ['name', 'age'],
      activityColumns: ['name'],
    });
    expect(defaults.repositoryIds).toEqual(['a', 'b']);
  });
  it('normalizes invalid scalars and uses the first scalar occurrence', () => {
    expect(
      resolveOverviewSettings(
        'age=31&change=maybe',
        { ...defaults, ageDays: 90, showChange: true },
        definition,
        asOf,
      ).value,
    ).toMatchObject({ ageDays: 30, showChange: false });
    expect(
      resolveOverviewSettings(
        'age=60&age=90&period=last-month&period=this-year',
        null,
        definition,
        asOf,
      ).value,
    ).toMatchObject({ ageDays: 60, period: { kind: 'preset', preset: 'last-month' } });
  });
  it.each([
    'period=bad',
    'period=custom&from=2026-10-09&through=2026-10-06',
    'from=2026-10-01',
    'period=custom&from=2027-01-01&through=2027-01-02',
  ])('shows an honest fallback for an invalid timeframe: %s', (search) => {
    const result = resolveOverviewSettings(search, null, definition, asOf);
    expect(result.value.period).toEqual({ kind: 'preset', preset: 'this-month' });
    expect(result.notice).toContain('invalid');
  });
  it('round-trips custom and relative selections without freezing relative dates', () => {
    const custom = {
      ...defaults,
      repositoryIds: [],
      period: { kind: 'custom' as const, from: '2026-10-06', through: '2026-10-08' },
    };
    const query = writeOverviewSettings('tag=a&tag=b&activity.sort=opened', custom);
    expect(resolveOverviewSettings(query, null, definition, asOf).value).toEqual(custom);
    expect(new URLSearchParams(query).getAll('tag')).toEqual(['a', 'b']);
    expect(new URLSearchParams(query).get('activity.sort')).toBe('opened');
    const relative = writeOverviewSettings(query, defaults);
    expect(new URLSearchParams(relative).has('from')).toBe(false);
    expect(new URLSearchParams(relative).get('period')).toBe('this-month');
    expect(
      readOverviewPreferences(serializeOverviewPreferences(defaults), definition, asOf),
    ).toEqual(defaults);
  });
  it.each([null, '{', 'null', '{"version":2}', '{"version":1,"settings":{}}'])(
    'ignores invalid or unsupported stored preferences %s',
    (raw) => expect(readOverviewPreferences(raw, definition, asOf)).toBeNull(),
  );
  it('rejects saved custom ranges beyond the sample clock and scopes keys by account', () => {
    const future = {
      ...defaults,
      period: { kind: 'custom' as const, from: '2027-01-01', through: '2027-01-02' },
    };
    expect(
      readOverviewPreferences(serializeOverviewPreferences(future), definition, asOf),
    ).toBeNull();
    expect(overviewPreferenceKey('a')).not.toBe(overviewPreferenceKey('b'));
  });
  it('resets only this report query and distinguishes display-only updates', () => {
    const query = writeOverviewSettings(
      'tag=a&tag=b&backlog.q=x&backlog.sort=total&activity.page=2&activity.dir=desc',
      defaults,
    );
    expect(resetOverviewQuery(query)).toBe('tag=a&tag=b');
    expect(changesOverviewScope({ backlogColumns: ['name'] })).toBe(false);
    expect(changesOverviewScope({ period: defaults.period })).toBe(true);
    expect(changesOverviewScope({ showChange: true })).toBe(true);
  });
  it('ignores only peer table fields when tracking pending searches', () => {
    expect(
      tableLocationStamp('/repos', 'backlog.q=a&activity.sort=opened&repo=x', ['activity']),
    ).toBe('/repos?backlog.q=a&repo=x');
    expect(tableLocationStamp('/repos', 'backlog.q=a&activity.sort=opened&repo=x', [])).toBe(
      '/repos?backlog.q=a&activity.sort=opened&repo=x',
    );
    expect(readSavedTableSort('{"sort":"name","descending":true}', ['name'])).toEqual({
      sort: 'name',
      descending: true,
    });
    for (const raw of [
      null,
      '{',
      'null',
      '{"sort":1}',
      '{"sort":"retired","descending":true}',
      '{"sort":"name"}',
      '{"sort":"name","descending":1}',
    ])
      expect(readSavedTableSort(raw, ['name'])).toBeNull();
  });
});

describe('prepared display selection', () => {
  it('keeps one backlog copy and selects the correct prepared periods and repository subset', () => {
    const samples = repositoryOverviewSamples();
    expect(samples.repositories).toHaveLength(18);
    expect(samples.periods).toHaveLength(8);
    const month = selectOverviewSample(samples, { kind: 'preset', preset: 'this-month' }, [
      'repo-prebidjs',
    ]);
    const week = selectOverviewSample(samples, { kind: 'preset', preset: 'this-week' }, [
      'repo-prebidjs',
    ]);
    expect(month.rows).toHaveLength(1);
    expect(month.rows[0].activity.counts.prsOpened.value).toBe(47);
    expect(week.rows[0].activity.counts.prsOpened.value).toBe(12);
    expect(week.rows[0].backlog).toEqual(month.rows[0].backlog);
    expect(
      selectOverviewSample(samples, { kind: 'preset', preset: 'this-month' }, []).rows,
    ).toEqual([]);
  });
  it('distinguishes the prepared custom range from absent samples without inventing zeros', () => {
    const samples = repositoryOverviewSamples();
    const prepared = selectOverviewSample(
      samples,
      { kind: 'custom', from: '2026-10-06', through: '2026-10-08' },
      ['repo-prebidjs'],
    );
    expect(prepared.rows[0].activity.counts.prsOpened.value).toBe(7);
    const absent = selectOverviewSample(
      samples,
      { kind: 'custom', from: '2026-10-01', through: '2026-10-02' },
      ['repo-prebidjs'],
    );
    expect(absent.activitySample).toBe('unprepared');
    expect(absent.rows[0].activity.counts.prsOpened).toMatchObject({
      status: 'missing',
      value: null,
    });
    expect(absent.rows[0].comparison.mergeDuration.days.value).toBeNull();
    expect(absent.rows[0].backlog).toEqual(prepared.rows[0].backlog);
  });
  it('does not silently substitute another repository or incomplete prepared data', () => {
    const samples = repositoryOverviewSamples();
    expect(() =>
      selectOverviewSample(samples, { kind: 'preset', preset: 'this-week' }, ['retired']),
    ).toThrow('Unknown sample repository');
    delete samples.periods[0].rows['repo-prebidjs'];
    expect(() =>
      selectOverviewSample(samples, { kind: 'preset', preset: 'this-week' }, ['repo-prebidjs']),
    ).toThrow('Incomplete prepared sample');
  });
});
