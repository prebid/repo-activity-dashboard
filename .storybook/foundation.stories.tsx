import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import { MetricValue } from '../src/components/metrics/metric-value';
import { EmptyState } from '../src/components/feedback/empty-state';
import type { DataColumn } from '../src/components/tables/data-table';
import { LocalDataTable as DataTable } from '../src/components/tables/local-data-table';
import { ReviewDistribution } from '../src/components/charts/review-distribution';
interface Row {
  id: string;
  name: string;
  count: number | null;
}
const columns: DataColumn<Row>[] = [
  { id: 'name', label: 'Name', value: (r) => r.name },
  {
    id: 'count',
    label: 'Count',
    value: (r) => r.count,
    cell: (r) => <MetricValue value={r.count} />,
  },
];
function Specimen({ state = 'normal' }: { state?: 'normal' | 'empty' | 'loading' | 'error' }) {
  if (state === 'loading') return <EmptyState kind="loading" title="Loading records…" />;
  if (state === 'error')
    return (
      <EmptyState kind="error" title="Could not load records" onRetry={() => {}}>
        Retry example
      </EmptyState>
    );
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
      <DataTable
        search="local"
        title="Sample table"
        columns={columns}
        rows={
          state === 'empty'
            ? []
            : [
                { id: 'one', name: 'A long repository name with details', count: 834 },
                { id: 'two', name: 'Known zero', count: 0 },
                { id: 'three', name: 'Missing history', count: null },
              ]
        }
      />
      <ReviewDistribution
        data={[
          { label: '0 reviewers', count: 40 },
          { label: '1 reviewer', count: 40 },
          { label: '2 reviewers', count: 40 },
        ]}
      />
    </div>
  );
}
const meta = { title: 'Foundation/Shared components', component: Specimen } satisfies Meta<
  typeof Specimen
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'loading' } };
export const Error: Story = { args: { state: 'error' } };
