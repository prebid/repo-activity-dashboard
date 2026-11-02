import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import { FiltersIcon } from '../src/components/ui/icons';
import { MetricValue } from '../src/components/metrics/metric-value';
import type { DataColumn, DataTableProps } from '../src/components/tables/data-table';
import { LocalDataTable } from '../src/components/tables/local-data-table';
import { columnSetChange, columnSetChoice } from '../src/lib/presentation/contribution-lens';
import { additionalMetricDefinitions } from '../src/models/contribution-activity';
import { columnSetIds, roleMetrics } from '../src/models/contribution-lens';
import { contributionSelectionGroups } from '../src/models/contribution-metrics';
import { contributionMetricIds, contributionMetrics } from '../src/models/contributions';
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

interface CreditRow {
  id: string;
  name: string;
  company: string;
  values: Record<string, number>;
}
const commentIds = ['prComments', 'issueComments'] as const;
const creditColumns: DataColumn<CreditRow>[] = [
  {
    id: 'name',
    label: 'Name',
    selectionGroup: 'Identity',
    value: (row) => row.name,
    hideable: false,
  },
  { id: 'company', label: 'Company', selectionGroup: 'Identity', value: (row) => row.company },
  ...[
    ...contributionMetricIds.map((id) => ({
      id,
      label: contributionMetrics[id].label,
      selectionGroup: contributionSelectionGroups[id],
    })),
    ...commentIds.map((id) => ({
      id,
      label: additionalMetricDefinitions[id].label,
      selectionGroup: additionalMetricDefinitions[id].group,
    })),
  ].map((column): DataColumn<CreditRow> => ({
    ...column,
    align: 'right',
    value: (row) => row.values[column.id],
  })),
];
const creditRows: CreditRow[] = Array.from({ length: 8 }, (_, index) => ({
  id: 'account-' + (index + 1),
  name: 'Account ' + (index + 1),
  company: index % 3 === 2 ? 'Unmapped company' : index % 2 ? 'Example Beacon' : 'Example Acme',
  values: Object.fromEntries(
    [...contributionMetricIds, ...commentIds].map((id, metric) => [
      id,
      (index * 7 + metric * 3) % 11,
    ]),
  ),
}));
const hideableIds = creditColumns
  .filter((column) => column.hideable !== false)
  .map((column) => column.id);
const showing = (ids: readonly string[]) =>
  Object.fromEntries(hideableIds.map((id) => [id, id === 'company' || ids.includes(id)]));

/** A table whose Columns menu and CSV dialog offer the contribution Column set choice. */
function ColumnSetsSpecimen({ initial }: { initial: Record<string, boolean> }) {
  const [visible, setVisible] = useState(initial);
  const sets = columnSetChoice(hideableIds, (id) => {
    const set = columnSetIds.find((item) => item === id);
    if (set)
      setVisible(
        (current) =>
          columnSetChange(
            set,
            'contributors',
            { visible: current, sort: { sort: '', descending: false } },
            'report',
          ).visible,
      );
  });
  return (
    <main>
      <LocalDataTable
        search="local"
        title="Sample credits"
        description="One row per account; a Column set decides the metric columns."
        rows={creditRows}
        columns={creditColumns}
        exportName="sample-credits.csv"
        visibility={{ value: visible, onChange: setVisible, sets }}
      />
    </main>
  );
}
/** The Contributor set is showing, so Columns names it and the menu's set radio is checked. */
export const ColumnSets: Story = {
  render: () => <ColumnSetsSpecimen initial={showing(roleMetrics.contributor)} />,
};
/** A metric beyond the Contributor set is showing, so Columns reads Custom and no set is checked. */
export const ColumnSetsCustom: Story = {
  render: () => (
    <ColumnSetsSpecimen initial={showing([...roleMetrics.contributor, 'prComments'])} />
  ),
};
