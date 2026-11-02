import type { Measurement } from './reporting-measurement';
import type { TimelineInterval } from './reporting-timeline';
import type { SelectableColumn } from './column-selection';

export interface TimelineMetricDefinition extends SelectableColumn {
  unit: 'count' | 'days';
  defaultVisible: boolean;
  /**
   * A heading drawn over the metric's column on screen only, never in metric names, Columns, the
   * CSV dialog or CSV headers.
   */
  displayGroup?: string;
}
export interface TimelineDisplayRow {
  interval: TimelineInterval;
  values: Partial<Record<string, Measurement>>;
}
