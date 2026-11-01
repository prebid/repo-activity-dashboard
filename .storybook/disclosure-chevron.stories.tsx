import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import { DisclosureChevron } from '../src/components/ui/disclosure-chevron';

// The chevron reads its state from its trigger, so each story renders both disclosure forms.
function Specimen({ open }: { open: boolean }) {
  return (
    <main className="space-y-6">
      <h1 className="sr-only">Disclosure chevron</h1>
      <Button variant="ghost" aria-expanded={open}>
        Hide charts
        <DisclosureChevron />
      </Button>
      <details open={open} className="text-body">
        <summary className="flex w-fit items-center gap-1.5">
          Signing in for the first time?
          <DisclosureChevron />
        </summary>
        <p className="mt-2 text-muted-foreground">
          Use the temporary password your administrator sent.
        </p>
      </details>
    </main>
  );
}

const meta = {
  title: 'Primitives/Disclosure chevron',
  component: Specimen,
} satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Closed: Story = { args: { open: false } };
export const Open: Story = { args: { open: true } };
