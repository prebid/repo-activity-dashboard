/** Selection organization is independent of grouped table headings and CSV labels. */
export interface SelectableColumn {
  id: string;
  label: string;
  group?: string;
  selectionGroup?: string;
  selectionSection?: string;
  description?: string;
  required?: boolean;
}
/** The on-screen metric name: "Group — Label", or the label alone for an ungrouped metric. */
export function metricName({ group, label }: Pick<SelectableColumn, 'group' | 'label'>): string {
  return group ? group + ' — ' + label : label;
}
/** One choice of a Column set: a name and the columns it shows. */
export interface ColumnSetOption {
  id: string;
  label: string;
  columnIds: readonly string[];
}
/**
 * Named column sets at the top of a Columns menu and the CSV dialog. A set decides the columns in
 * `domain`, and the one listing every hideable column decides them all; others keep their state.
 */
export interface ColumnSetChoice {
  /** The group's name, such as "Column set". */
  label: string;
  /** The columns a set decides. */
  domain: readonly string[];
  options: readonly ColumnSetOption[];
  /** Apply a set: the feature changes the columns, and any lead sort, in one change. */
  onChoose: (id: string) => void;
}
