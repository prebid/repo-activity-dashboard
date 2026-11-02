import { z } from 'zod';
import { repositoryCatalog } from '@/config/repositories';
import { periodSelectionSchema } from '@/models/reporting-period';
import { agingThresholds, agingThresholdSchema } from '@/models/repository-overview';
import {
  overviewSettingsSchema,
  type OverviewSettings,
  type OverviewSettingsDefinition,
} from '@/models/overview-settings';
import {
  overviewActivityColumnIds,
  overviewBacklogColumnIds,
  overviewDefaultActivityColumnIds,
  overviewDefaultBacklogColumnIds,
} from '@/models/table-columns';
import type { PreferenceSectionKey } from '@/models/preferences';
import type { TableQuery } from '@/models/table-query';
import { preferenceKey, readSavedTableSort } from './table-query';
import { validateActivityPeriods } from './overview-periods';
import { mergeValues, sortToken } from './repository-url';
import type { SavedViewValues } from './url/entry';
import { periodSelection, periodValue } from './url/period';
import type { UrlValue, UrlValues } from './url/registry';

import { normalizeOverviewSettings } from './url/legacy/overview';
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

export function changesOverviewScope(patch: Partial<OverviewSettings>): boolean {
  return ['repositoryIds', 'periods', 'ageThresholds'].some((key) => key in patch);
}

const slugOf = (id: string) => repositoryCatalog.find((row) => row.id === id)?.slug;
const idOf = (slug: string) => repositoryCatalog.find((row) => row.slug === slug)?.id;
/**
 * The Summary's scope as URL fields: repositories by slug, the periods and the PR age thresholds.
 * Every field is present; one at its v1 default is dropped when the URL is written.
 */
export function overviewScopeValues(
  settings: OverviewSettings,
): Record<string, UrlValue | undefined> {
  return {
    repo: settings.repositoryIds.map((id) => slugOf(id) ?? id),
    period: periodValue(settings.periods[0]),
    period2: settings.periods[1] && periodValue(settings.periods[1]),
    age: settings.ageThresholds.map(String),
  };
}
/**
 * The Summary settings a URL selects, with the viewer's column choices (which stay out of URLs).
 * Null when a value names an unknown repository or threshold, or periods that cannot be compared.
 */
export function readOverviewValues(
  values: UrlValues,
  columns: Pick<OverviewSettings, 'backlogColumns' | 'activityColumns'>,
  definition: OverviewSettingsDefinition,
  asOf: string,
): OverviewSettings | null {
  const list = (value: UrlValue | undefined) => (Array.isArray(value) ? value : undefined);
  const slugs = list(values.repo);
  const repositoryIds = slugs
    ? slugs.map(idOf)
    : definition.repositoryIds.map((id) => id as string | undefined);
  const periods = [values.period ?? 'this-month', values.period2]
    .filter((value): value is string => typeof value === 'string')
    .map(periodSelection);
  const ages = (list(values.age) ?? ['30']).map(Number);
  if (
    repositoryIds.some((id) => id === undefined || !definition.repositoryIds.includes(id)) ||
    periods.some((period) => period === null) ||
    ages.some((days) => !(agingThresholds as readonly number[]).includes(days))
  )
    return null;
  const selected = periods as NonNullable<(typeof periods)[number]>[];
  if (validateActivityPeriods(selected, asOf)) return null;
  return normalizeOverviewSettings(
    {
      repositoryIds: repositoryIds as string[],
      periods: selected,
      ageThresholds: ages as OverviewSettings['ageThresholds'],
      ...columns,
    },
    definition,
    asOf,
  );
}

type SavedSort = Pick<TableQuery, 'sort' | 'descending'>;
/**
 * The values a bare Summary entry takes from the viewer's saved settings and table sorts (decision
 * C2): the scope, and each table's sort; null when nothing is saved.
 */
export function overviewSavedValues(
  settings: OverviewSettings | null,
  backlogSort: SavedSort | null,
  activitySort: SavedSort | null,
): SavedViewValues | null {
  if (!settings && !backlogSort && !activitySort) return null;
  return {
    scope: settings ? mergeValues({}, overviewScopeValues(settings)) : {},
    presentation: mergeValues(
      {},
      { bsort: sortToken(backlogSort), asort: sortToken(activitySort) },
    ),
  };
}
/** The Summary definition from the catalog, for links built outside the Summary page. */
export const overviewCatalogDefinition: OverviewSettingsDefinition = {
  repositoryIds: repositoryCatalog.filter((row) => row.enabled).map((row) => row.id),
  backlogColumns: overviewBacklogColumnIds,
  activityColumns: overviewActivityColumnIds,
  defaultBacklogColumns: overviewDefaultBacklogColumnIds,
  defaultActivityColumns: overviewDefaultActivityColumnIds,
};
/**
 * A Summary entry's saved values read from the cookie's sections in the browser, for entry links;
 * null when a saved custom range needs the server's validation, so the link stays bare and the
 * server redirects.
 */
export function overviewEntryValues(
  read: (section: PreferenceSectionKey) => string | null,
  asOf: string,
): SavedViewValues | null {
  const settings = readOverviewPreferences(read('overview'), overviewCatalogDefinition, asOf);
  if (settings?.periods.some((period) => period.kind === 'custom')) return null;
  return overviewSavedValues(
    settings,
    readSavedTableSort(read('overview.backlog.sort'), overviewBacklogColumnIds),
    readSavedTableSort(read('overview.activity.sort'), overviewActivityColumnIds),
  );
}
