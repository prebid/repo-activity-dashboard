import type { Measurement } from '@/models/reporting-measurement';

export const measurementSortNote =
  'Complete values first, then partial subtotals ranked by value; unavailable values last.';
export function measurementSortGroup(value: Measurement): number {
  return value.status === 'complete' ? 0 : value.status === 'partial' ? 1 : 2;
}
