import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataLegend, type DataLegendMark } from '../src/components/feedback/data-legend';

// A legend sits in a table, matrix or chart footer, so each story shows it on the card surface.
function Specimen({ marks }: { marks?: readonly DataLegendMark[] }) {
  return (
    <div className="max-w-2xl rounded-lg border bg-card p-4">
      <DataLegend marks={marks} />
    </div>
  );
}

const meta = { title: 'Feedback/Data legend', component: Specimen } satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BothMarks: Story = {};
export const MissingOnly: Story = { args: { marks: ['missing'] } };
export const PartialOnly: Story = { args: { marks: ['partial'] } };
