import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuScrollGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type DropdownMenuSize,
} from '../src/components/ui/dropdown-menu';
import {
  ColumnsIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
  ThemeSystemIcon,
} from '../src/components/ui/icons';

type Contents = 'actions' | 'choices' | 'long' | 'pinned';
type Placement = 'start' | 'right' | 'bottom';

function Items({ contents }: { contents: Contents }) {
  const [types, setTypes] = useState(['human', 'agent']);
  const [theme, setTheme] = useState('system');
  if (contents === 'actions')
    return (
      <>
        <DropdownMenuItem>Open repository</DropdownMenuItem>
        <DropdownMenuItem>Copy link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem inset>Export CSV</DropdownMenuItem>
        <DropdownMenuItem disabled>Archive (unavailable)</DropdownMenuItem>
      </>
    );
  if (contents === 'pinned')
    // Taller than the room below the trigger: only the group scrolls, so the label and the
    // closing action stay in view.
    return (
      <>
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        <DropdownMenuScrollGroup aria-label="Columns">
          {Array.from({ length: 40 }, (_, index) => (
            <DropdownMenuCheckboxItem
              key={index}
              checked={index % 4 !== 3}
              onSelect={(event) => event.preventDefault()}
            >
              Column {index + 1}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuScrollGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Apply columns</DropdownMenuItem>
      </>
    );
  if (contents === 'long')
    return (
      <>
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        <DropdownMenuGroup aria-label="Columns">
          {Array.from({ length: 40 }, (_, index) => (
            <DropdownMenuCheckboxItem
              key={index}
              checked={index % 4 !== 3}
              onSelect={(event) => event.preventDefault()}
            >
              Column {index + 1}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </>
    );
  const toggle = (type: string, checked: boolean) =>
    setTypes((previous) =>
      checked ? [...previous, type] : previous.filter((value) => value !== type),
    );
  return (
    <>
      <DropdownMenuLabel>Include account types</DropdownMenuLabel>
      <DropdownMenuGroup aria-label="Include account types">
        {(
          [
            ['human', 'Human'],
            ['agent', 'Prebid agent'],
            ['bot', 'Bot'],
          ] as const
        ).map(([type, label]) => (
          <DropdownMenuCheckboxItem
            key={type}
            checked={types.includes(type)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => toggle(type, checked === true)}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuCheckboxItem checked="indeterminate" onSelect={(e) => e.preventDefault()}>
          Some repositories
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked disabled>
          Unknown (always included)
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
        {(
          [
            ['system', 'System', ThemeSystemIcon],
            ['light', 'Light', ThemeLightIcon],
            ['dark', 'Dark', ThemeDarkIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <DropdownMenuRadioItem key={value} value={value} onSelect={(e) => e.preventDefault()}>
            <Icon size={16} />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

/**
 * Opens on load. Non-modal, like the column, theme and account-type menus, so nothing outside the
 * menu is hidden from assistive technology while the trigger stays focusable.
 */
function MenuSpecimen({
  size = 'auto',
  contents = 'actions',
  placement = 'start',
}: {
  size?: DropdownMenuSize;
  contents?: Contents;
  placement?: Placement;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setContainer}
      // At the right edge a menu wider than the room beside its trigger shifts back inside the
      // 16px collision padding; at the bottom edge it opens above its trigger.
      className={
        placement === 'right'
          ? 'flex min-h-screen items-start justify-end p-4'
          : placement === 'bottom'
            ? 'flex min-h-screen items-end p-4'
            : 'flex'
      }
    >
      {container && (
        <DropdownMenu defaultOpen modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">
              <ColumnsIcon size={14} />
              Menu ({size})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent container={container} size={size} align="start">
            <Items contents={contents} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

const meta = {
  title: 'Overlays/Menu',
  component: MenuSpecimen,
} satisfies Meta<typeof MenuSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const LabelsAndCheckboxes: Story = { args: { size: 'sm', contents: 'choices' } };
export const Scrolling: Story = { args: { size: 'md', contents: 'long' } };
export const PinnedRows: Story = { args: { size: 'sm', contents: 'pinned' } };
export const RightEdge: Story = {
  args: { size: 'lg', contents: 'choices', placement: 'right' },
  parameters: { layout: 'fullscreen' },
};
export const BottomEdge: Story = {
  args: { size: 'sm', contents: 'choices', placement: 'bottom' },
  parameters: { layout: 'fullscreen' },
};
