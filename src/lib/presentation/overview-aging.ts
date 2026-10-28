import { agingThresholds, type AgingThreshold } from '@/models/repository-overview';

export function agingColumnId(days: AgingThreshold): string {
  return 'agedPrs' + days;
}

export function agingThresholdForColumn(id: string): AgingThreshold | undefined {
  return agingThresholds.find((days) => agingColumnId(days) === id);
}
