import { z } from 'zod';
import { periodSelectionSchema } from './reporting-period';
import { agingThresholdSchema } from './repository-overview';

export const overviewSettingsSchema = z
  .object({
    repositoryIds: z.array(z.string()).max(200),
    periods: z.array(periodSelectionSchema).min(1).max(2),
    ageThresholds: z.array(agingThresholdSchema).max(6),
    backlogColumns: z.array(z.string()).max(100),
    activityColumns: z.array(z.string()).max(100),
  })
  .strict();
export type OverviewSettings = z.infer<typeof overviewSettingsSchema>;
export interface OverviewSettingsDefinition {
  repositoryIds: readonly string[];
  backlogColumns: readonly string[];
  activityColumns: readonly string[];
  defaultBacklogColumns: readonly string[];
  defaultActivityColumns: readonly string[];
}
export interface OverviewSettingsControl {
  value: OverviewSettings;
  update: (patch: Partial<OverviewSettings>) => void;
  reset: () => void;
  storageAvailable: boolean;
  notice?: string;
}
