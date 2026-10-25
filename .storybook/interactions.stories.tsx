import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../src/components/ui/select';
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
      <Select value={selection} onValueChange={setSelection}>
        <SelectTrigger id="long-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 50 }, (_, i) => (
            <SelectItem key={i} value={'item-' + (i + 1)}>
              Repository {i + 1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Sample dialog</DialogTitle>
          <DialogDescription>Keyboard and focus behavior.</DialogDescription>
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Open menu</Button>
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
