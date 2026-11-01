import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import { NativeSelect } from '../src/components/ui/native-select';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../src/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../src/components/ui/dropdown-menu';
import { Switch } from '../src/components/ui/switch';
import { Label } from '../src/components/ui/label';

function InteractionSpecimen() {
  const [selection, setSelection] = useState('item-1');
  return (
    <main className="max-w-sm space-y-4">
      <h1>Interactive primitives</h1>
      <Label htmlFor="long-select">Repository selection</Label>
      <NativeSelect
        id="long-select"
        value={selection}
        onChange={(event) => setSelection(event.target.value)}
      >
        {Array.from({ length: 50 }, (_, i) => (
          <option key={i} value={'item-' + (i + 1)}>
            Repository {i + 1}
          </option>
        ))}
      </NativeSelect>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="primary">Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Sample dialog</DialogTitle>
          <DialogDescription>Keyboard and focus behavior.</DialogDescription>
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Open menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>First action</DropdownMenuItem>
          <DropdownMenuItem>Second action</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex gap-3">
        <Switch id="sample-switch" />
        <Label htmlFor="sample-switch">Sample preference</Label>
      </div>
    </main>
  );
}
const meta = {
  title: 'Foundation/Interactive primitives',
  component: InteractionSpecimen,
} satisfies Meta<typeof InteractionSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Keyboard: Story = {};
