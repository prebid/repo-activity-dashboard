import type { OverviewSettings } from '@/models/overview-settings';
import type { TableController } from './table-controller';
import { type TableQuery } from '@/models/table-query';
import { agingColumnId } from './overview-aging';

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
