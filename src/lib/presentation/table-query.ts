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
