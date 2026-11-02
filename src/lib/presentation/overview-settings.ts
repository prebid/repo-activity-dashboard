import { z } from 'zod';
import { periodSelectionSchema } from '@/models/reporting-period';
import { agingThresholdSchema } from '@/models/repository-overview';
import {
  overviewSettingsSchema,
  type OverviewSettings,
  type OverviewSettingsDefinition,
} from '@/models/overview-settings';

import { preferenceKey, writeTableQuery } from './table-query';
import { type TableQuery } from '@/models/table-query';

import { initialTableQuery } from './table-controller';

import { normalizeOverviewSettings, ownedParameters } from './url/legacy/overview';
export {
  defaultOverviewSettings,
  normalizeOverviewSettings,
  overviewSummarySearch,
  resolveOverviewSettings,
} from './url/legacy/overview';

const previousSettingsSchema = overviewSettingsSchema
  .omit({ periods: true })
  .extend({ period: periodSelectionSchema, showChange: z.boolean() })
  .strict();
const legacySettingsSchema = previousSettingsSchema
  .omit({ ageThresholds: true })
  .extend({ ageDays: agingThresholdSchema })
  .strict();
const storedSchema = z.discriminatedUnion('version', [
  z.object({ version: z.literal(1), settings: legacySettingsSchema }).strict(),
  z.object({ version: z.literal(2), settings: previousSettingsSchema }).strict(),
  z.object({ version: z.literal(3), settings: overviewSettingsSchema }).strict(),
]);

export function overviewPreferenceKey(viewerId: string): string {
  return preferenceKey(viewerId, 'all-repositories:preferences');
}
export function serializeOverviewPreferences(settings: OverviewSettings): string {
  return JSON.stringify({ version: 3, settings });
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
      const { ageDays, period, showChange: _removed, ...previous } = parsed.data.settings;
      return normalizeOverviewSettings(
        {
          ...previous,
          periods: [period],
          ageThresholds: previous.backlogColumns.includes('agedPrs') ? [ageDays] : [],
        },
        definition,
        asOf,
      );
    }
    if (parsed.data.version === 2) {
      const { period, showChange: _removed, ...previous } = parsed.data.settings;
      return normalizeOverviewSettings({ ...previous, periods: [period] }, definition, asOf);
    }
    return normalizeOverviewSettings(parsed.data.settings, definition, asOf);
  } catch {
    return null;
  }
}

/** Explicit scope makes shared URLs and history independent of later saved defaults. */
export function writeOverviewSettings(search: string, settings: OverviewSettings): string {
  const params = new URLSearchParams(search);
  for (const key of ownedParameters) params.delete(key);
  if (settings.repositoryIds.length)
    for (const id of settings.repositoryIds) params.append('repo', id);
  else params.set('repo', '');
  settings.periods.forEach((period, index) => {
    const suffix = index === 0 ? '' : '2';
    params.set('period' + suffix, period.kind === 'preset' ? period.preset : 'custom');
    if (period.kind === 'custom') {
      params.set('from' + suffix, period.from);
      params.set('through' + suffix, period.through);
    }
  });
  if (settings.ageThresholds.length)
    for (const days of settings.ageThresholds) params.append('age', String(days));
  else params.set('age', '');
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
  return ['repositoryIds', 'periods', 'ageThresholds'].some((key) => key in patch);
}
