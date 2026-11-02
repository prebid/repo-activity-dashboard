import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import { FiltersIcon } from '../src/components/ui/icons';
import { MetricValue } from '../src/components/metrics/metric-value';
import type { DataColumn, DataTableProps } from '../src/components/tables/data-table';
import { LocalDataTable } from '../src/components/tables/local-data-table';
import type { TableQuery } from '../src/models/table-query';

interface Row {
  id: string;
  title: string;
  count: number | null;
}
const columns: DataColumn<Row>[] = [
  { id: 'title', label: 'Title', value: (row) => row.title, hideable: false },
  {
    id: 'count',
    label: 'Count',
    align: 'right',
    value: (row) => row.count,
    cell: (row) => <MetricValue value={row.count} />,
  },
];
const rows: Row[] = Array.from({ length: 120 }, (_, index) => ({
  id: String(index + 1),
  title: index === 119 ? 'Oldest keyboard issue' : 'Record ' + String(index + 1).padStart(3, '0'),
  count: index % 9 === 4 ? null : index % 7,
}));

type SpecimenProps = Pick<DataTableProps<Row>, 'search' | 'footerNote' | 'legend'> & {
  rowCount: number;
  initialQuery?: TableQuery;
  feature?: boolean;
};

/** The table toolbar and footer: search, the feature's control, Columns, Export CSV; count, notes and pager. */
function Specimen({ rowCount, feature = true, ...props }: SpecimenProps) {
  return (
    <main>
      <LocalDataTable
        {...props}
        title="Sample records"
        description="One row per record."
        rows={rows.slice(0, rowCount)}
        columns={columns}
        exportName="sample-records.csv"
        controls={
          feature && (
            <Button type="button" variant="secondary">
              <FiltersIcon size={14} />
              Filters
            </Button>
          )
        }
      />
    </main>
  );
}

const meta = {
  title: 'Tables/Table toolbar',
  component: Specimen,
  args: { search: 'local', rowCount: 120 },
} satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Several pages: the pager sits beside the count. */
export const LocalSearch: Story = {};
/** A set query makes the count say "matching"; one page of results hides the pager. */
export const ActiveSearch: Story = {
  args: { initialQuery: { search: 'keyboard', sort: '', descending: false, page: 1 } },
};
/** No search field; the notes slot holds a footer note and the legend for the dashes shown. */
export const NoSearch: Story = {
  args: {
    search: 'none',
    rowCount: 12,
    feature: false,
    footerNote: 'Counts are sample values.',
    legend: ['missing'],
  },
};
