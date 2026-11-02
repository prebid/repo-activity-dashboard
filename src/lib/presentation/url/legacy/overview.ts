// Frozen pre-codec URL readers, moved unchanged. They decode old links for the 307 to the
// canonical form and serve callers that have not moved to the codec yet.
import { defaultPeriod, periodSelectionSchema } from '@/models/reporting-period';
import { agingThresholds, defaultAgingThreshold } from '@/models/repository-overview';
import {
  overviewSettingsSchema,
  type OverviewSettings,
  type OverviewSettingsDefinition,
} from '@/models/overview-settings';
import { type TableQuery } from '@/models/table-query';
import { resolveReportingPeriod } from '../../reporting-period';
import { validateActivityPeriods } from '../../overview-periods';
import { agingColumnId, agingThresholdForColumn } from '../../overview-aging';
import type { TableController } from '../../table-controller';
import { safeReturnPath } from '../../navigation';
import { contributionUrlFits } from '../../contribution-return';
export const ownedParameters = [
  'repo',
  'period',
  'from',
  'through',
  'period2',
  'from2',
  'through2',
  'age',
  'change',
];
/** Only the parameters the Summary page reads; anything else is dropped from saved return links. */
export function overviewSummarySearch(search: string): string {
  const params = new URLSearchParams(search),
    result = new URLSearchParams();
  for (const [key, value] of params)
    if (
      ownedParameters.includes(key) ||
      /^(backlog|activity)\.(q|sort|dir|page|columns)$/.test(key)
    )
      result.append(key, value);
  return result.toString();
}
export function defaultOverviewSettings(definition: OverviewSettingsDefinition): OverviewSettings {
  return {
    repositoryIds: [...definition.repositoryIds],
    periods: [defaultPeriod],
    ageThresholds: [defaultAgingThreshold],
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
  const periodError = validateActivityPeriods(value.periods, asOf);
  if (periodError) throw new Error(periodError);
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
  if (
    ['period', 'from', 'through', 'period2', 'from2', 'through2'].some((key) => params.has(key))
  ) {
    const readPeriod = (suffix: string) => {
      const preset = params.get('period' + suffix);
      const selected = periodSelectionSchema.parse(
        preset === 'custom'
          ? {
              kind: 'custom',
              from: params.get('from' + suffix),
              through: params.get('through' + suffix),
            }
          : { kind: 'preset', preset },
      );
      resolveReportingPeriod(selected, asOf);
      return selected;
    };
    try {
      result.periods = [readPeriod('')];
    } catch {
      result.periods = defaults.periods;
      notice = 'The timeframe in this link is invalid. Showing This month.';
    }
    if (['period2', 'from2', 'through2'].some((key) => params.has(key))) {
      try {
        const pair = [result.periods[0], readPeriod('2')];
        const error = validateActivityPeriods(pair, asOf);
        if (error) throw new Error(error);
        result.periods = pair;
      } catch {
        notice = 'The second period is invalid or duplicates the first. Showing one period.';
      }
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
  return { value: normalizeOverviewSettings(result, definition, asOf), notice };
}
const priorities = {
  backlog: ['totalOpenPrs', 'nonDraftPrs'],
  activity: ['prsOpened', 'prsMerged'],
};
/** Keep chosen sorts when visible; derive defaults without saving an automatic choice. */
export function withOverviewSort<T extends TableController>(
  controller: T,
  table: 'backlog' | 'activity',
  settings: OverviewSettings,
) {
  const visible = new Set([
    'name',
    ...(table === 'backlog'
      ? [...settings.backlogColumns, ...settings.ageThresholds.map(agingColumnId)]
      : settings.activityColumns),
  ]);
  const fallback = priorities[table].find((column) => visible.has(column)) ?? 'name';
  function resolve(query: TableQuery): TableQuery {
    return visible.has(query.sort)
      ? query
      : { ...query, sort: fallback, descending: fallback !== 'name' };
  }
  const query = resolve(controller.query);
  return {
    ...controller,
    query,
    update: (patch: Partial<TableQuery>) =>
      controller.update({
        ...(!visible.has(controller.query.sort)
          ? { sort: query.sort, descending: query.descending }
          : {}),
        ...patch,
      }),
    flushSearch: () => resolve(controller.flushSearch()),
  };
}
/** One bounded Summary snapshot, reduced to what the Summary page reads; never a Timeline URL. */
export function repositoryMatrixSummaryHref(value: string | null | undefined): string | null {
  if (!value) return '/repos';
  if (!contributionUrlFits(value) || safeReturnPath(value) !== value) return null;
  const url = new URL(value, 'https://dashboard.invalid');
  if (
    url.pathname !== '/repos' ||
    url.searchParams.has('timeline') ||
    url.searchParams.has('summary')
  )
    return null;
  const kept = overviewSummarySearch(url.search);
  return kept ? '/repos?' + kept : '/repos';
}
