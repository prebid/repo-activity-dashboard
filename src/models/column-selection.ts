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
