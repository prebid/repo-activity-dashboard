import type { TableValueColumn } from '@/models/table-values';
import type { TableQuery } from '@/models/table-query';
import { compareValues } from './format';

/** Stable full-population ordering, used before display pagination and CSV projection. */
export function selectTableRows<T>(
  rows: readonly T[],
  columns: readonly TableValueColumn<T>[],
  query: Pick<TableQuery, 'search' | 'sort' | 'descending'>,
  searchable = true,
): T[] {
  const search = searchable ? query.search.toLocaleLowerCase('en') : '';
  const sort = columns.find((column) => column.id === query.sort);
  return rows
    .filter(
      (row) =>
        !search ||
        columns.some((column) =>
          String(column.value(row) ?? '')
            .toLocaleLowerCase('en')
            .includes(search),
        ),
    )
    .sort((a, b) => {
      if (!sort) return 0;
      const group = (sort.sortGroup?.(a) ?? 0) - (sort.sortGroup?.(b) ?? 0);
      return (
        group ||
        compareValues(
          (sort.sortValue ?? sort.value)(a),
          (sort.sortValue ?? sort.value)(b),
          query.descending ? 'desc' : 'asc',
        )
      );
    });
}
