import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Callout, type CalloutTone } from '../src/components/feedback/callout';

const examples = {
  info: {
    lead: 'Link limit',
    body: 'Supporting-record links cover the first 1,000 records in each cell; the counts include every record.',
  },
  warning: {
    lead: 'Data coverage',
    body: 'Two of 18 repositories have partial history before March 2026. Totals include only verified records.',
  },
  error: {
    lead: 'Export failed',
    body: 'The CSV could not be prepared. Your selection is unchanged; try the export again.',
  },
} as const satisfies Record<CalloutTone, { lead: string; body: string }>;

// Callouts sit inside panels, so each story shows one on the card surface.
function Specimen({ tone, withLead = false }: { tone: CalloutTone; withLead?: boolean }) {
  return (
    <div className="max-w-2xl rounded-lg border bg-card p-4">
      <Callout tone={tone} lead={withLead ? examples[tone].lead : undefined}>
        {examples[tone].body}
      </Callout>
    </div>
  );
}

const meta = { title: 'Feedback/Callout', component: Specimen } satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Info: Story = { args: { tone: 'info' } };
export const Warning: Story = { args: { tone: 'warning' } };
export const Error: Story = { args: { tone: 'error' } };
export const InfoWithLead: Story = { args: { tone: 'info', withLead: true } };
export const WarningWithLead: Story = { args: { tone: 'warning', withLead: true } };
export const ErrorWithLead: Story = { args: { tone: 'error', withLead: true } };
