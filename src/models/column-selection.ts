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
