// A table's search, sort and page as registry fields, for `useTableController`'s codec binding.
import type { TableQuery } from '@/models/table-query';
import { parseQuery, serializeQuery } from './codec';
import { defaultValue } from './defaults';
import type { UrlRoute, UrlValue, UrlValues } from './registry';

/** The registry names a table's state uses on a route, and its peers' on the same page. */
export interface TableFields {
  readonly route: UrlRoute;
  /** Absent for a table without search (the Summary tables). */
  readonly search?: string;
  readonly sort: string;
  readonly page: string;
  /** Fields of other tables on the page, which do not reset this table's search draft. */
  readonly peers?: readonly string[];
}
type Sort = Pick<TableQuery, 'sort' | 'descending'>;

function valuesOf(fields: TableFields, search: string): UrlValues {
  const parsed = parseQuery(fields.route, search);
  return parsed.kind === 'canonical' ? parsed.values : {};
}
const sortOf = (token: string): Sort => ({
  sort: token.replace(/^-/, ''),
  descending: token.startsWith('-'),
});
/**
 * The table state an address shows. An absent sort is the v1 default (or `fallback` where the
 * registry has none); a sort on a column the table lacks is ignored, as the frozen reader did.
 */
export function readBoundTableQuery(
  fields: TableFields,
  search: string,
  allowed: readonly string[],
  fallback?: Sort,
  correctedPage?: number,
): TableQuery {
  const values = valuesOf(fields, search);
  const named = values[fields.sort];
  const fallbackToken = defaultValue(fields.route, fields.sort, values);
  const sort =
    typeof named === 'string'
      ? sortOf(named)
      : typeof fallbackToken === 'string'
        ? sortOf(fallbackToken)
        : (fallback ?? { sort: '', descending: false });
  const page = Number(values[fields.page] ?? 1);
  const query = {
    search: fields.search ? ((values[fields.search] as string | undefined) ?? '') : '',
    ...(allowed.includes(sort.sort) ? sort : { sort: '', descending: false }),
    page: correctedPage ?? page,
  };
  return query;
}
/** The query (no leading `?`) after a table change; other fields, including `back`, are kept. */
export function writeBoundTableQuery(
  fields: TableFields,
  search: string,
  patch: Partial<TableQuery>,
): string {
  const values: Record<string, UrlValue> = { ...valuesOf(fields, search) };
  const set = (name: string | undefined, value: string | undefined) => {
    if (!name) return;
    if (value === undefined || value === '') delete values[name];
    else values[name] = value;
  };
  if (patch.search !== undefined) set(fields.search, patch.search);
  if (patch.sort !== undefined || patch.descending !== undefined) {
    const current = values[fields.sort];
    const previous =
      typeof current === 'string' ? sortOf(current) : { sort: '', descending: false };
    const sort = patch.sort ?? previous.sort;
    set(fields.sort, sort && ((patch.descending ?? previous.descending) ? '-' : '') + sort);
  }
  if (patch.page !== undefined) set(fields.page, patch.page > 1 ? String(patch.page) : undefined);
  return serializeQuery(fields.route, values);
}
/** The address a table's search draft belongs to: everything but its peers' fields. */
export function boundLocationStamp(fields: TableFields, pathname: string, search: string): string {
  const values: Record<string, UrlValue> = { ...valuesOf(fields, search) };
  for (const name of fields.peers ?? []) delete values[name];
  return pathname + '?' + serializeQuery(fields.route, values);
}
