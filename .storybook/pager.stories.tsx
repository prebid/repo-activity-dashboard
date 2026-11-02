import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Pager, type PagerProps } from '../src/components/tables/pager';

type SpecimenProps = Pick<PagerProps, 'pageCount' | 'size' | 'disabled'> & {
  initialPage: number;
};

function PagerSpecimen({ initialPage, ...props }: SpecimenProps) {
  const [page, setPage] = useState(initialPage);
  return (
    <main className="space-y-4">
      <h1 className="text-heading font-semibold">Pager</h1>
      <Pager {...props} label="Sample table pages" page={page} onPageChange={setPage} />
    </main>
  );
}

const meta = {
  title: 'Tables/Pager',
  component: PagerSpecimen,
  args: { initialPage: 1, pageCount: 5 },
} satisfies Meta<typeof PagerSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const First: Story = {};
export const Middle: Story = { args: { initialPage: 3 } };
export const Last: Story = { args: { initialPage: 5 } };
export const Disabled: Story = { args: { initialPage: 3, disabled: true } };
/** The 28px size used inside dialogs. */
export const Compact: Story = { args: { initialPage: 2, pageCount: 12, size: 'sm' } };
