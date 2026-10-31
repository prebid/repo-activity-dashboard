import type { Count } from '@/models/reporting-measurement';

export const complete = (value: number): Count => ({ status: 'complete', value });
export const missing = (reason: string): Count => ({ status: 'missing', value: null, reason });
export const partial = (value: number, reason: string): Count => ({
  status: 'partial',
  value,
  reason,
});
