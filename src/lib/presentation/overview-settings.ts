import { z } from 'zod';
import { defaultPeriod, periodSelectionSchema } from '@/models/reporting-period';
import {
  agingThresholds,
  agingThresholdSchema,
  defaultAgingThreshold,
} from '@/models/repository-overview';
import {
  overviewSettingsSchema,
  type OverviewSettings,
  type OverviewSettingsDefinition,
} from '@/models/overview-settings';
import { resolveReportingPeriod } from './reporting-period';
import { preferenceKey, writeTableQuery, type TableQuery } from './table-query';
import { initialTableQuery } from './table-controller';
import { agingThresholdForColumn } from './overview-aging';

const ownedParameters = ['repo', 'period', 'from', 'through', 'age', 'change'];
const legacySettingsSchema = overviewSettingsSchema
  .omit({ ageThresholds: true })
  .extend({ ageDays: agingThresholdSchema })
  .strict();
const storedSchema = z.discriminatedUnion('version', [
  z.object({ version: z.literal(1), settings: legacySettingsSchema }).strict(),
  z.object({ version: z.literal(2), settings: overviewSettingsSchema }).strict(),
]);

export function defaultOverviewSettings(definition: OverviewSettingsDefinition): OverviewSettings {
  return {
    repositoryIds: [...definition.repositoryIds],
    period: defaultPeriod,
    ageThresholds: [defaultAgingThreshold],
    showChange: false,
    backlogColumns: [...definition.defaultBacklogColumns],
    activityColumns: [...definition.defaultActivityColumns],
  };
}

export function normalizeOverviewSettings(
  input: OverviewSettings,
  definition: OverviewSettingsDefinition,
  asOf: string,
): OverviewSettings {
  const value = overviewSettingsSchema.parse(input);
  resolveReportingPeriod(value.period, asOf);
  const columns = (selected: string[], allowed: readonly string[]) =>
    allowed.filter((id) => id === 'name' || selected.includes(id));
  return {
    ...value,
    repositoryIds: definition.repositoryIds.filter((id) => value.repositoryIds.includes(id)),
    ageThresholds: agingThresholds.filter((days) => value.ageThresholds.includes(days)),
    backlogColumns: columns(value.backlogColumns, definition.backlogColumns).filter(
      (id) => agingThresholdForColumn(id) === undefined,
    ),
    activityColumns: columns(value.activityColumns, definition.activityColumns),
  };
}

export function overviewPreferenceKey(viewerId: string): string {
  return preferenceKey(viewerId, 'all-repositories:preferences');
}
export function serializeOverviewPreferences(settings: OverviewSettings): string {
  return JSON.stringify({ version: 2, settings });
}
export function readOverviewPreferences(
  raw: string | null,
  definition: OverviewSettingsDefinition,
  asOf: string,
): OverviewSettings | null {
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw ?? 'null'));
    if (!parsed.success) return null;
    if (parsed.data.version === 1) {
      const { ageDays, ...previous } = parsed.data.settings;
      return normalizeOverviewSettings(
        {
          ...previous,
          ageThresholds: previous.backlogColumns.includes('agedPrs') ? [ageDays] : [],
        },
        definition,
        asOf,
      );
    }
    return normalizeOverviewSettings(parsed.data.settings, definition, asOf);
  } catch {
    return null;
  }
}

export function resolveOverviewSettings(
  search: string,
  saved: OverviewSettings | null,
  definition: OverviewSettingsDefinition,
  asOf: string,
): { value: OverviewSettings; notice?: string } {
  const defaults = defaultOverviewSettings(definition);
  const result = { ...(saved ?? defaults) };
  const params = new URLSearchParams(search);
  let notice: string | undefined;
  if (params.has('repo')) {
    const requested = new Set(params.getAll('repo'));
    result.repositoryIds = definition.repositoryIds.filter((id) => requested.has(id));
  }
  if (params.has('period') || params.has('from') || params.has('through')) {
    const preset = params.get('period');
    const selected = periodSelectionSchema.safeParse(
      preset === 'custom'
        ? { kind: 'custom', from: params.get('from'), through: params.get('through') }
        : { kind: 'preset', preset },
    );
    try {
      if (!selected.success) throw new Error('Invalid period');
      resolveReportingPeriod(selected.data, asOf);
      result.period = selected.data;
    } catch {
      result.period = defaults.period;
      notice = 'The timeframe in this link is invalid. Showing This month.';
    }
  }
  if (params.has('age')) {
    const requested = params.getAll('age');
    const selected = agingThresholds.filter((days) =>
      requested.some((value) => value !== '' && Number(value) === days),
    );
    result.ageThresholds =
      selected.length || requested.every((value) => value === '')
        ? selected
        : defaults.ageThresholds;
  }
  if (params.has('change')) result.showChange = params.get('change') === '1';
  return { value: normalizeOverviewSettings(result, definition, asOf), notice };
}

/** Explicit scope makes shared URLs and history independent of later saved defaults. */
export function writeOverviewSettings(search: string, settings: OverviewSettings): string {
  const params = new URLSearchParams(search);
  for (const key of ownedParameters) params.delete(key);
  if (settings.repositoryIds.length)
    for (const id of settings.repositoryIds) params.append('repo', id);
  else params.set('repo', '');
  params.set('period', settings.period.kind === 'preset' ? settings.period.preset : 'custom');
  if (settings.period.kind === 'custom') {
    params.set('from', settings.period.from);
    params.set('through', settings.period.through);
  }
  if (settings.ageThresholds.length)
    for (const days of settings.ageThresholds) params.append('age', String(days));
  else params.set('age', '');
  params.set('change', settings.showChange ? '1' : '0');
  return params.toString();
}

export function resetOverviewQuery(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of ownedParameters) params.delete(key);
  return writeTableQuery(
    writeTableQuery(params.toString(), 'backlog', initialTableQuery),
    'activity',
    initialTableQuery,
  );
}

export function writeOverviewTableQueries(
  search: string,
  backlog: TableQuery,
  activity: TableQuery,
): string {
  // The overview uses repository selection, not table search. Retire old search URLs on updates.
  return writeTableQuery(
    writeTableQuery(search, 'backlog', { ...backlog, search: '' }),
    'activity',
    { ...activity, search: '' },
  );
}

export function changesOverviewScope(patch: Partial<OverviewSettings>): boolean {
  return ['repositoryIds', 'period', 'ageThresholds', 'showChange'].some((key) => key in patch);
}
