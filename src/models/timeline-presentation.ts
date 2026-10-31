import type { Measurement } from './reporting-measurement';
import type { TimelineInterval } from './reporting-timeline';
import type { SelectableColumn } from './column-selection';

export interface TimelineMetricDefinition extends SelectableColumn {
  unit: 'count' | 'days';
  defaultVisible: boolean;
}
export interface TimelineDisplayRow {
  interval: TimelineInterval;
  values: Partial<Record<string, Measurement>>;
}
