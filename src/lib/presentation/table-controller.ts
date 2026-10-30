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
