export const tablePageSize = 50;
export interface TableQuery {
  search: string;
  sort: string;
  descending: boolean;
  page: number;
}
export function readTableQuery(
  search: string,
  key: string,
  allowed: readonly string[],
): TableQuery {
  const p = new URLSearchParams(search);
  const sort = p.get(key + '.sort') ?? '';
  const page = Number(p.get(key + '.page') ?? 1);
  return {
    search: p.get(key + '.q') ?? '',
    sort: allowed.includes(sort) ? sort : '',
    descending: p.get(key + '.dir') === 'desc',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}
export function effectiveTableQuery(
  search: string,
  key: string,
  allowed: readonly string[],
  saved?: Pick<TableQuery, 'sort' | 'descending'>,
  correctedPage?: number,
): TableQuery {
  const query = readTableQuery(search, key, allowed);
  if (!new URLSearchParams(search).has(key + '.sort') && saved && allowed.includes(saved.sort)) {
    query.sort = saved.sort;
    query.descending = saved.descending;
  }
  if (correctedPage !== undefined) query.page = correctedPage;
  return query;
}
export function writeTableQuery(search: string, key: string, patch: Partial<TableQuery>): string {
  const p = new URLSearchParams(search);
  for (const [field, name] of [
    ['search', 'q'],
    ['sort', 'sort'],
    ['descending', 'dir'],
    ['page', 'page'],
  ] as const) {
    const value = patch[field];
    if (value === undefined) continue;
    if (field === 'descending' && value === false) {
      p.delete(key + '.' + name);
      continue;
    }
    const rendered = field === 'descending' ? 'desc' : String(value);
    if (rendered === '' || (field === 'page' && value === 1)) p.delete(key + '.' + name);
    else p.set(key + '.' + name, rendered);
  }
  return p.toString();
}
export function preferenceKey(viewerId: string, tableId: string): string {
  return 'dashboard:v1:' + encodeURIComponent(viewerId) + ':' + encodeURIComponent(tableId);
}

export function tableLocationStamp(
  pathname: string,
  search: string,
  peerKeys: readonly string[],
): string {
  const params = new URLSearchParams(search);
  for (const key of peerKeys)
    for (const field of ['q', 'sort', 'dir', 'page']) params.delete(key + '.' + field);
  return pathname + '?' + params.toString();
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
