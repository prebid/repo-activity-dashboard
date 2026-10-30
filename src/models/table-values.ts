/** Values shared by table rendering and full-population exports. */
export interface TableValueColumn<T> {
  id: string;
  value: (row: T) => string | number | null;
  sortValue?: (row: T) => string | number | null;
  /** Lower ranks come first in either direction; values sort within each rank. */
  sortGroup?: (row: T) => number;
  sortNote?: string;
}
