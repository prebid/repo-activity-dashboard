import type { TableQuery } from '@/models/table-query';
export {
  readTableQuery,
  effectiveTableQuery,
  writeTableQuery,
  tableLocationStamp,
} from './url/legacy/table-query';
export function preferenceKey(viewerId: string, tableId: string): string {
  return 'dashboard:v1:' + encodeURIComponent(viewerId) + ':' + encodeURIComponent(tableId);
}

export function readSavedTableSort(
  raw: string | null,
  allowed: readonly string[],
): Pick<TableQuery, 'sort' | 'descending'> | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (
      value &&
      typeof value === 'object' &&
      'sort' in value &&
      typeof value.sort === 'string' &&
      allowed.includes(value.sort) &&
      'descending' in value &&
      typeof value.descending === 'boolean'
    )
      return { sort: value.sort, descending: value.descending };
  } catch {
    /* Corrupt preferences are not a storage outage. */
  }
  return null;
}
