import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RecordStatus, type RecordStatusProps } from '../src/components/github/record-status';

// A status sits under a record title in a table row, so each story shows it on the card and on
// the hovered-row surface.
function Specimen({ record, title }: { record: RecordStatusProps; title: string }) {
  return (
    <div className="max-w-2xl overflow-hidden rounded-lg border bg-card">
      {[false, true].map((hovered) => (
        <div
          key={String(hovered)}
          className="flex flex-col gap-1 px-4 py-3"
          style={hovered ? { background: 'var(--prebid-row-hover)' } : undefined}
        >
          <span className="text-body">{title}</span>
          <RecordStatus {...record} />
        </div>
      ))}
    </div>
  );
}

const meta = { title: 'Identity/Record status', component: Specimen } satisfies Meta<
  typeof Specimen
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PrOpen: Story = {
  args: {
    record: { kind: 'pr', status: 'open' },
    title: 'Add a consent signal to the bid request',
  },
};
export const PrDraft: Story = {
  args: { record: { kind: 'pr', status: 'draft' }, title: 'Draft: refactor the timeout handler' },
};
export const PrMerged: Story = {
  args: { record: { kind: 'pr', status: 'merged' }, title: 'Fix currency conversion rounding' },
};
export const PrClosed: Story = {
  args: { record: { kind: 'pr', status: 'closed' }, title: 'Remove the legacy adapter alias' },
};
export const IssueOpen: Story = {
  args: { record: { kind: 'issue', status: 'open' }, title: 'Bid caching ignores the TTL buffer' },
};
export const IssueClosed: Story = {
  args: { record: { kind: 'issue', status: 'closed' }, title: 'Docs link to the old wiki page' },
};
