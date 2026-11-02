import { describe, expect, it } from 'vitest';
import {
  changesOverviewScope,
  defaultOverviewSettings,
  normalizeOverviewSettings,
  overviewPreferenceKey,
  overviewCatalogDefinition,
  overviewEntryValues,
  overviewSavedValues,
  overviewScopeValues,
  readOverviewPreferences,
  readOverviewValues,
  resolveOverviewSettings,
  serializeOverviewPreferences,
} from '@/lib/presentation/overview-settings';
import { mergeValues } from '@/lib/presentation/repository-url';
import { parseQuery, serializeQuery } from '@/lib/presentation/url/codec';
import type { OverviewSettings } from '@/models/overview-settings';
import type { PreferenceSectionKey } from '@/models/preferences';
import type { UrlValues } from '@/lib/presentation/url/registry';
import { readSavedTableSort, tableLocationStamp } from '@/lib/presentation/table-query';
import {
  customSampleSelection,
  repositoryOverviewSample,
  repositoryOverviewSamples,
} from '@/mocks/repository-overview';
import { selectOverviewSample } from '@/lib/presentation/overview-samples';
import { agingColumnId, agingThresholdForColumn } from '@/lib/presentation/overview-aging';

const definition = {
  repositoryIds: ['a', 'b'],
  backlogColumns: ['name', 'total', 'age'],
  activityColumns: ['name', 'opened', 'merged'],
  defaultBacklogColumns: ['name', 'total'],
  defaultActivityColumns: ['name', 'opened'],
};
const asOf = '2026-10-24T12:00:00.000Z';
const defaults = defaultOverviewSettings(definition);
/** The Summary query a scope writes, and the settings that query reads back. */
function summaryQuery(settings: OverviewSettings, catalog = overviewCatalogDefinition) {
  const query = serializeQuery('/repos', mergeValues({}, overviewScopeValues(settings)));
  const parsed = parseQuery('/repos', query);
  if (parsed.kind !== 'canonical') throw new Error('Expected a canonical query: ' + query);
  return { query, read: readOverviewValues(parsed.values, settings, catalog, asOf) };
}
const catalogDefaults = defaultOverviewSettings(overviewCatalogDefinition);
describe('overview settings contracts', () => {
  it('stores aging choices once, supports none, and canonicalizes repeated age parameters', () => {
    const configured = {
      ...definition,
      backlogColumns: [...definition.backlogColumns, 'agedPrs30', 'agedPrs90'],
    };
    const selected = normalizeOverviewSettings(
      { ...defaults, ageThresholds: [90, 30, 90], backlogColumns: ['name', 'total', 'agedPrs30'] },
      configured,
      asOf,
    );
    expect(selected.ageThresholds).toEqual([30, 90]);
    expect(selected.backlogColumns).toEqual(['name', 'total']);
    const written = summaryQuery({ ...catalogDefaults, ageThresholds: selected.ageThresholds });
    expect(written.query).toBe('age=30,90');
    expect(written.read?.ageThresholds).toEqual([30, 90]);
    expect(summaryQuery({ ...catalogDefaults, ageThresholds: [] }).query).toBe('age=');
    // Old links repeated the key; the frozen reader still reads them.
    expect(resolveOverviewSettings('age=30&age=90', null, configured, asOf).value).toEqual(
      selected,
    );
    expect(resolveOverviewSettings('age=', selected, configured, asOf).value.ageThresholds).toEqual(
      [],
    );
    expect(
      resolveOverviewSettings('age=60&age=60&age=unknown', null, configured, asOf).value
        .ageThresholds,
    ).toEqual([60]);
    const empty = { ...defaults, ageThresholds: [] };
    expect(
      readOverviewPreferences(serializeOverviewPreferences(empty), configured, asOf)?.ageThresholds,
    ).toEqual([]);
    expect(resolveOverviewSettings('age=', selected, configured, asOf).value.ageThresholds).toEqual(
      [],
    );
    expect(agingColumnId(60)).toBe('agedPrs60');
    expect(agingThresholdForColumn('agedPrs180')).toBe(180);
    expect(agingThresholdForColumn('agedPrs')).toBeUndefined();
  });
  it('migrates visible and hidden v1 aging columns without losing other preferences', () => {
    const { ageThresholds: _old, periods: previousPeriods, ...base } = defaults;
    const legacy = {
      ...base,
      repositoryIds: ['b'],
      ageDays: 90,
      period: previousPeriods[0],
      showChange: true,
      backlogColumns: ['name', 'total', 'agedPrs'],
    };
    expect(
      readOverviewPreferences(JSON.stringify({ version: 1, settings: legacy }), definition, asOf),
    ).toMatchObject({
      repositoryIds: ['b'],
      ageThresholds: [90],
      backlogColumns: ['name', 'total'],
    });
    expect(
      readOverviewPreferences(
        JSON.stringify({ version: 1, settings: { ...legacy, backlogColumns: ['name', 'total'] } }),
        definition,
        asOf,
      )?.ageThresholds,
    ).toEqual([]);
  });
  it('keeps explicit URL values above saved values and saved values above defaults', () => {
    const saved = {
      ...defaults,
      repositoryIds: ['b'],
      ageThresholds: [90 as const],
      periods: [{ kind: 'preset' as const, preset: 'last-week' as const }],
    };
    expect(resolveOverviewSettings('', null, definition, asOf).value).toEqual(defaults);
    expect(resolveOverviewSettings('', saved, definition, asOf).value).toEqual(saved);
    expect(
      resolveOverviewSettings('repo=a&age=60&change=0&period=this-year', saved, definition, asOf)
        .value,
    ).toMatchObject({
      repositoryIds: ['a'],
      ageThresholds: [60],
      periods: [{ kind: 'preset', preset: 'this-year' }],
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
  it('normalizes invalid ages, accepts multiple ages, and uses the first period', () => {
    expect(
      resolveOverviewSettings(
        'age=31&change=maybe',
        { ...defaults, ageThresholds: [90] },
        definition,
        asOf,
      ).value,
    ).toMatchObject({ ageThresholds: [30] });
    expect(
      resolveOverviewSettings(
        'age=60&age=90&period=last-month&period=this-year',
        null,
        definition,
        asOf,
      ).value,
    ).toMatchObject({
      ageThresholds: [60, 90],
      periods: [{ kind: 'preset', preset: 'last-month' }],
    });
  });
  it.each([
    'period=bad',
    'period=custom&from=2026-10-09&through=2026-10-06',
    'from=2026-10-01',
    'period=custom&from=2027-01-01&through=2027-01-02',
  ])('shows an honest fallback for an invalid timeframe: %s', (search) => {
    const result = resolveOverviewSettings(search, null, definition, asOf);
    expect(result.value.periods).toEqual([{ kind: 'preset', preset: 'this-month' }]);
    expect(result.notice).toContain('invalid');
  });
  it('round-trips custom and relative selections without freezing relative dates', () => {
    const custom = {
      ...catalogDefaults,
      repositoryIds: [],
      periods: [{ kind: 'custom' as const, from: '2026-10-06', through: '2026-10-08' }],
    };
    const written = summaryQuery(custom);
    expect(written.query).toBe('repo=&period=2026-10-06..2026-10-08');
    expect(written.read).toEqual(custom);
    // A relative period stays a preset, and the defaults write nothing.
    expect(summaryQuery(catalogDefaults)).toEqual({ query: '', read: catalogDefaults });
    expect(
      readOverviewPreferences(serializeOverviewPreferences(defaults), definition, asOf),
    ).toEqual(defaults);
  });
  it.each<UrlValues>([
    { repo: ['retired'] },
    { period: 'next-month' },
    { period: '2027-01-01..2027-01-02' },
    { period: 'this-month', period2: 'this-month' },
    { age: ['31'] },
  ])('reads no Summary from values it does not offer: %o', (values) => {
    expect(readOverviewValues(values, catalogDefaults, overviewCatalogDefinition, asOf)).toBeNull();
  });
  it('turns saved settings and sorts into the values a bare entry opens', () => {
    expect(overviewSavedValues(null, null, null)).toBeNull();
    const saved = { ...catalogDefaults, repositoryIds: ['repo-prebidjs'], ageThresholds: [] };
    expect(overviewSavedValues(saved, { sort: 'name', descending: false }, null)).toEqual({
      scope: { repo: ['prebidjs'], period: 'this-month', age: [] },
      presentation: { bsort: 'name' },
    });
    expect(overviewSavedValues(null, null, { sort: 'prsMerged', descending: true })).toEqual({
      scope: {},
      presentation: { asort: '-prsMerged' },
    });
    const sections = (overview: OverviewSettings) => {
      const raw: Partial<Record<PreferenceSectionKey, string>> = {
        overview: serializeOverviewPreferences(overview),
        'overview.activity.sort': '{"sort":"prsMerged","descending":true}',
      };
      return (section: PreferenceSectionKey) => raw[section] ?? null;
    };
    expect(overviewEntryValues(sections(saved), asOf)).toEqual({
      scope: { repo: ['prebidjs'], period: 'this-month', age: [] },
      presentation: { asort: '-prsMerged' },
    });
    // A saved custom range needs the server's validation, so the link stays bare.
    expect(
      overviewEntryValues(
        sections({
          ...saved,
          periods: [{ kind: 'custom', from: '2026-10-06', through: '2026-10-08' }],
        }),
        asOf,
      ),
    ).toBeNull();
  });
  it.each([null, '{', 'null', '{"version":2}', '{"version":1,"settings":{}}'])(
    'ignores invalid or unsupported stored preferences %s',
    (raw) => expect(readOverviewPreferences(raw, definition, asOf)).toBeNull(),
  );
  it('rejects saved custom ranges beyond the sample clock and scopes keys by account', () => {
    const future = {
      ...defaults,
      periods: [{ kind: 'custom' as const, from: '2027-01-01', through: '2027-01-02' }],
    };
    expect(
      readOverviewPreferences(serializeOverviewPreferences(future), definition, asOf),
    ).toBeNull();
    expect(overviewPreferenceKey('a')).not.toBe(overviewPreferenceKey('b'));
  });
  it('distinguishes scope changes from display-only updates', () => {
    expect(changesOverviewScope({ backlogColumns: ['name'] })).toBe(false);
    expect(changesOverviewScope({ periods: defaults.periods })).toBe(true);
    expect(changesOverviewScope({ ageThresholds: [30, 60] })).toBe(true);
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
    expect(samples.periods).toHaveLength(9);
    const month = selectOverviewSample(samples, { kind: 'preset', preset: 'this-month' }, [
      'repo-prebidjs',
    ]);
    const week = selectOverviewSample(samples, { kind: 'preset', preset: 'this-week' }, [
      'repo-prebidjs',
    ]);
    expect(month.rows).toHaveLength(1);
    expect(month.rows[0].activity).toEqual(
      repositoryOverviewSample({ kind: 'preset', preset: 'this-month' }, ['repo-prebidjs']).rows[0]
        .activity,
    );
    expect(week.rows[0].activity).toEqual(
      repositoryOverviewSample({ kind: 'preset', preset: 'this-week' }, ['repo-prebidjs']).rows[0]
        .activity,
    );
    expect(week.rows[0].activity).not.toEqual(month.rows[0].activity);
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
    expect(prepared.rows[0].activity).toEqual(
      repositoryOverviewSample(customSampleSelection, ['repo-prebidjs']).rows[0].activity,
    );
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
