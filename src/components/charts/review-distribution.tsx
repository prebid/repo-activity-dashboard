'use client';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
export interface DistributionPoint {
  label: string;
  count: number;
}
export function ReviewDistribution({ data }: { data: DistributionPoint[] }) {
  return (
    <figure aria-label="Human review distribution" className="rounded-lg border bg-card p-4">
      <figcaption className="mb-3 font-semibold">Human review distribution</figcaption>
      <div className="h-48" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} accessibilityLayer={false}>
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--popover)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <Bar dataKey="count" fill="var(--chart-1)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="flex flex-wrap gap-4 text-body">
        {data.map((p) => (
          <div key={p.label}>
            <dt>{p.label}</dt>
            <dd>{p.count} PRs</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
