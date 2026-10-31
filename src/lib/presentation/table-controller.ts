import { type TableQuery } from '@/models/table-query';
export interface TableController {
  scopeKey: string;
  query: TableQuery;
  draftSearch: string;
  setSearch: (value: string) => void;
  update: (patch: Partial<TableQuery>) => void;
  flushSearch: () => TableQuery;
  reconcilePage: (page: number) => void;
}
export const initialTableQuery: TableQuery = { search: '', sort: '', descending: false, page: 1 };
/** The query a link should carry now: the typed search, restarting pages when it changed. */
export function pendingTableQuery(
  table: Pick<TableController, 'query' | 'draftSearch'>,
): TableQuery {
  return {
    ...table.query,
    search: table.draftSearch,
    page: table.draftSearch === table.query.search ? table.query.page : 1,
  };
}
