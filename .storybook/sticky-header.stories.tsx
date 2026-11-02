import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { DataColumn } from '../src/components/tables/data-table';
import { LocalDataTable } from '../src/components/tables/local-data-table';
import {
  MeasurementDifference,
  MeasurementValue,
} from '../src/components/metrics/measurement-value';
import drillable from '../src/components/metrics/drillable-number.module.css';
import type { Measurement } from '../src/models/reporting-measurement';

interface Row {
  id: string;
  name: string;
  authored: Measurement;
  merged: Measurement;
  reviews: Measurement;
  previous: Measurement;
}
const count = (value: number, partial = false): Measurement =>
  partial
    ? { status: 'partial', value, reason: 'Sample coverage is incomplete for this account.' }
    : { status: 'complete', value };
const rows: Row[] = Array.from({ length: 50 }, (_, index) => ({
  id: 'account-' + index,
  name: index === 3 ? 'An account with a long display name that wraps' : 'Account ' + (index + 1),
  authored: count((index * 7) % 23, index % 9 === 2),
  merged: count((index * 5) % 17),
  reviews: count(index % 6 === 0 ? 0 : (index * 11) % 31),
  previous: count((index * 13) % 29),
}));

function columns(grouped: boolean): DataColumn<Row>[] {
  const heading = (displayGroup: string) => (grouped ? { displayGroup } : {});
  return [
    {
      id: 'name',
      label: 'Account',
      pinned: true,
      hideable: false,
      value: (row) => row.name,
    },
    {
      id: 'authored',
      label: 'PRs authored',
      align: 'right',
      width: 126,
      ...heading('Authoring'),
      value: (row) => row.authored.value,
      // A number that opens its records takes the drillable style.
      cell: (row) => (
        <a
          className={drillable.link}
          href={'#records-' + row.id}
          aria-label={row.name + ': PRs authored, ' + row.authored.value}
        >
          <MeasurementValue measurement={row.authored} />
        </a>
      ),
    },
    {
      id: 'merged',
      label: 'Authored PRs merged',
      align: 'right',
      width: 126,
      ...heading('Authoring'),
      value: (row) => row.merged.value,
      cell: (row) => <MeasurementValue measurement={row.merged} />,
    },
    {
      id: 'reviews',
      label: 'Reviewer contributions',
      align: 'right',
      width: 126,
      ...heading('Reviewing'),
      value: (row) => row.reviews.value,
      cell: (row) => <MeasurementValue measurement={row.reviews} />,
    },
    {
      id: 'change',
      label: 'Change in reviewer contributions',
      align: 'right',
      width: 126,
      ...heading('Reviewing'),
      value: (row) =>
        row.reviews.value === null || row.previous.value === null
          ? null
          : row.reviews.value - row.previous.value,
      cell: (row) => <MeasurementDifference first={row.reviews} second={row.previous} />,
    },
  ];
}

/** A 50-row table scrolls inside its bounded area, so the header row stays in view. */
function Specimen({ grouped }: { grouped: boolean }) {
  return (
    <main>
      <LocalDataTable
        title="Sample accounts"
        description="Partial values carry an asterisk past their digits; differences sign with the minus sign."
        search="local"
        rows={rows}
        columns={columns(grouped)}
        legend={['partial']}
      />
    </main>
  );
}

const meta = {
  title: 'Tables/Sticky header',
  component: Specimen,
  args: { grouped: true },
} satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Two header rows: display-only group headings over their metric labels. */
export const GroupedHeadings: Story = {};
export const SingleRow: Story = { args: { grouped: false } };
