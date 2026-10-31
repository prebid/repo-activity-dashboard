import { cloneElement, isValidElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TimelineChart } from '@/components/charts/timeline-chart';
import { buildTimelineIntervals } from '@/lib/presentation/reporting-timeline';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';

vi.mock('recharts', async (original) => ({
  ...(await original<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) =>
    isValidElement<{ width?: number; height?: number }>(children)
      ? cloneElement(children, { width: 800, height: 300 })
      : null,
}));
const metric: TimelineMetricDefinition = {
  id: 'medianMergeDays',
  label: 'Median merge time',
  group: 'Duration',
  unit: 'days',
  defaultVisible: true,
};
it('draws a marker for every known value between gaps in a dense series', () => {
  const intervals = buildTimelineIntervals(
    {
      range: {
        start: '2026-01-05T00:00:00.000Z',
        end: '2026-10-19T00:00:00.000Z',
        endInclusive: false,
      },
      grouping: 'week',
    },
    '2026-10-24T12:00:00.000Z',
  );
  expect(intervals.length).toBeGreaterThan(40);
  const known = new Map([
    [10, 5],
    [20, 61],
    [21, 3],
    [30, 1],
  ]);
  const rows = intervals.map((interval, index) => ({
    interval,
    values: {
      medianMergeDays: known.has(index)
        ? { status: 'complete' as const, value: known.get(index)! }
        : { status: 'not-applicable' as const, value: null, reason: 'No merged PRs.' },
    },
  }));
  const { container } = render(
    <TimelineChart
      rows={rows}
      metrics={[metric]}
      summary={rows[0].values}
      grouping="week"
      controls={{
        visible: true,
        metric: 'medianMergeDays',
        onVisibility: () => {},
        onMetric: () => {},
      }}
    />,
  );
  // Indexes 10 and 30 sit between gaps; 20 and 21 join into a drawn segment.
  expect(container.querySelectorAll('.recharts-line-dots circle')).toHaveLength(2);
});
