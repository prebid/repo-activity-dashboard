import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogSize,
} from '../src/components/ui/dialog';
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
} from '../src/components/ui/scrollable-dialog';

type Variant = 'plain' | 'definitions' | 'scrollable';

const definitions = [
  ['Opened', 'Pull requests opened in the selected period.'],
  ['Merged', 'Pull requests merged in the selected period, whenever they were opened.'],
  ['Closed unmerged', 'Pull requests closed without merging in the selected period.'],
  ['Median time to merge', 'The middle merge duration among merged pull requests.'],
] as const;

function Footer() {
  return (
    <DialogFooter className="gap-2 sm:space-x-0">
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button variant="primary">Apply</Button>
    </DialogFooter>
  );
}

function Body({ variant }: { variant: Variant }): ReactNode {
  if (variant === 'definitions')
    return (
      <dl className="grid gap-3 text-body">
        {definitions.map(([term, meaning]) => (
          <div key={term}>
            <dt className="font-semibold">{term}</dt>
            <dd className="text-muted-foreground">{meaning}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <p className="text-body">
      Choose which repositories the report includes. The selection applies to every table on this
      page.
    </p>
  );
}

/**
 * Opens on load without a trigger: a modal dialog hides everything outside it from assistive
 * technology, and a focusable trigger behind it would be an aria-hidden-focus violation.
 */
function DialogSpecimen({
  size = 'sm',
  variant = 'plain',
  title = 'Choose repositories',
}: {
  size?: DialogSize;
  variant?: Variant;
  title?: string;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setContainer}>
      {container && (
        <Dialog defaultOpen>
          {variant === 'scrollable' ? (
            <ScrollableDialogContent container={container}>
              <DialogHeader className="text-left">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>Choose the columns the export includes.</DialogDescription>
              </DialogHeader>
              <ScrollableDialogBody label="Export choices">
                {Array.from({ length: 30 }, (_, index) => (
                  <label key={index} className="flex items-center gap-2 text-body">
                    <input type="checkbox" defaultChecked={index % 3 === 0} />
                    Column {index + 1}
                  </label>
                ))}
              </ScrollableDialogBody>
              <Footer />
            </ScrollableDialogContent>
          ) : (
            <DialogContent container={container} size={size}>
              <DialogHeader className="text-left">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'} dialog,{' '}
                  {size === 'sm' ? 512 : size === 'md' ? 640 : 680}px wide at most.
                </DialogDescription>
              </DialogHeader>
              <Body variant={variant} />
              <Footer />
            </DialogContent>
          )}
        </Dialog>
      )}
    </div>
  );
}

const meta = {
  title: 'Overlays/Dialog',
  component: DialogSpecimen,
} satisfies Meta<typeof DialogSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Small: Story = { args: { size: 'sm' } };
export const Medium: Story = { args: { size: 'md', title: 'Filter pull requests' } };
export const Large: Story = {
  args: { size: 'lg', variant: 'definitions', title: 'Pull request column definitions' },
};
export const Scrollable: Story = {
  args: { variant: 'scrollable', title: 'Contributors CSV export' },
};
export const LongTitle: Story = {
  args: {
    title: 'Include and exclude accounts for every repository in the contribution report',
  },
};
