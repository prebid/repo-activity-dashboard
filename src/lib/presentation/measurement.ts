import type { Measurement } from '@/models/repository-overview';

/** Partial or missing operands cannot establish an exact period-over-period change. */
export function absoluteChange(current: Measurement, previous: Measurement): number | null {
  return current.status === 'complete' && previous.status === 'complete'
    ? current.value - previous.value
    : null;
}
