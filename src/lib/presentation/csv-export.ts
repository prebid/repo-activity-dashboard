import { csvCell } from './format';
interface CsvColumn<T> {
  id: string;
  label: string;
  group?: string;
  value: (row: T) => string | number | null;
  exportWith?: string;
}
/** Display choices select values; metadata stays automatic and metric-specific coverage follows its value. */
export function tableCsv<T>(
  rows: T[],
  outputColumns: readonly CsvColumn<T>[],
  displayIds: readonly string[],
  selectedIds: readonly string[],
): string {
  const columns = outputColumns.filter(
    (column) =>
      selectedIds.includes(column.id) ||
      (!displayIds.includes(column.id) &&
        (!column.exportWith || selectedIds.includes(column.exportWith))),
  );
  return serializeCsv(rows, columns);
}

export function serializeCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  return [
    columns
      .map((column) =>
        csvCell(
          column.group && !column.label.startsWith(column.group + ' — ')
            ? column.group + ' — ' + column.label
            : column.label,
        ),
      )
      .join(','),
    ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(',')),
  ].join('\r\n');
}
