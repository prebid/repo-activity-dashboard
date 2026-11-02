import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { DataColumn } from '../src/components/tables/data-table';
import { LocalDataTable } from '../src/components/tables/local-data-table';
import { MetricValue } from '../src/components/metrics/metric-value';
import type { TableQuery } from '../src/models/table-query';

interface Row {
  id: string;
  title: string;
  count: number;
}
// A text column, whose glyph follows its label, beside numeric columns, whose glyph leads.
const columns: DataColumn<Row>[] = [
  { id: 'title', label: 'Repository', value: (row) => row.title, width: 220 },
  {
    id: 'count',
    label: 'Open PRs',
    align: 'right',
    width: 120,
    value: (row) => row.count,
    cell: (row) => <MetricValue value={row.count} />,
  },
  {
    id: 'aged',
    label: 'Open longer than 90 days',
    align: 'right',
    width: 120,
    value: (row) => row.count % 4,
    cell: (row) => <MetricValue value={row.count % 4} />,
  },
];
const rows: Row[] = ['Prebid.js', 'Prebid Server (Go)', 'Prebid Mobile iOS'].map((title, i) => ({
  id: String(i),
  title,
  count: [137, 42, 9][i],
}));

/** Sort glyphs in their 14px slot: idle on every header, the arrow on the sorted one. */
function Specimen({ sort, descending }: { sort: string; descending: boolean }) {
  const initialQuery: TableQuery = { search: '', sort, descending, page: 1 };
  return (
    <main>
      <LocalDataTable
        title="Sort states"
        search="none"
        showColumnMenu={false}
        rows={rows}
        columns={columns}
        initialQuery={initialQuery}
      />
    </main>
  );
}

const meta = {
  title: 'Tables/Sort icon',
  component: Specimen,
  args: { sort: '', descending: false },
} satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
/** No sorted column: every header shows the idle glyph. */
export const Idle: Story = {};
export const TextAscending: Story = { args: { sort: 'title' } };
export const TextDescending: Story = { args: { sort: 'title', descending: true } };
export const NumericAscending: Story = { args: { sort: 'count' } };
export const NumericDescending: Story = { args: { sort: 'count', descending: true } };
