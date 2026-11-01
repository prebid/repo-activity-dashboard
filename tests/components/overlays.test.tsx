import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/dropdown-menu';
import { ScrollableDialogBody, ScrollableDialogContent } from '@/components/ui/scrollable-dialog';

// jsdom applies no stylesheet, so these tests pin the attributes and classes the styles select on;
// the rendered sizes, colours and positions are checked in the browser suite's stories.
describe('DialogContent', () => {
  it('opens at the small size on the scrim with Close focused and last', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose repositories</DialogTitle>
            <DialogDescription>Pick the report scope.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Choose repositories' });
    expect(dialog).toHaveAttribute('data-size', 'sm');
    expect(dialog).toHaveAccessibleDescription('Pick the report scope.');
    expect(dialog).toHaveClass('rounded-lg', 'bg-overlay', 'shadow-lg', 'overflow-y-auto');
    expect(document.querySelector('.bg-scrim')).toBeInTheDocument();
    const close = within(dialog).getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    expect(dialog.lastElementChild).toBe(close);
    expect(close).toHaveClass('absolute', 'right-3', 'top-3');
    expect(close.querySelector('svg')).toHaveAttribute('width', '16');
    // Merged through cn, so a class tailwind-merge reads as a conflict would be missing here.
    expect(screen.getByText('Choose repositories')).toHaveClass(
      'font-display',
      'text-title',
      'font-bold',
      'font-stretch-[var(--prebid-display-stretch)]',
    );
    expect(screen.getByText('Pick the report scope.')).toHaveClass(
      'text-body',
      'text-muted-foreground',
    );
    await user.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each(['md', 'lg'] as const)(
    'renders the %s size in the given container and focuses its own control first',
    async (size) => {
      const user = userEvent.setup();
      const container = document.createElement('section');
      document.body.append(container);
      try {
        render(
          <Dialog>
            <DialogTrigger>Open</DialogTrigger>
            <DialogContent container={container} size={size} className="consumer-dialog">
              <DialogTitle>Filters</DialogTitle>
              <DialogDescription>Narrow the records.</DialogDescription>
              <DialogFooter className="consumer-footer">
                <DialogClose>Cancel</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>,
        );
        await user.click(screen.getByRole('button', { name: 'Open' }));
        const dialog = within(container).getByRole('dialog', { name: 'Filters' });
        expect(dialog).toHaveAttribute('data-size', size);
        expect(dialog).toHaveClass('consumer-dialog');
        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
        expect(within(dialog).getByRole('button', { name: 'Cancel' }).parentElement).toHaveClass(
          'consumer-footer',
        );
      } finally {
        container.remove();
      }
    },
  );

  it('keeps the scrollable frame at the medium size with a labelled body', () => {
    render(
      <Dialog defaultOpen>
        <ScrollableDialogContent>
          <DialogTitle>Contributors CSV export</DialogTitle>
          <DialogDescription>Choose columns.</DialogDescription>
          <ScrollableDialogBody label="Export choices">
            <label>
              <input type="checkbox" /> Name
            </label>
          </ScrollableDialogBody>
        </ScrollableDialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Contributors CSV export' });
    expect(dialog).toHaveAttribute('data-size', 'md');
    expect(within(dialog).getByRole('region', { name: 'Export choices' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
});

function Menu({ size }: { size?: 'sm' | 'md' | 'lg' }) {
  const [theme, setTheme] = useState('system');
  const [bot, setBot] = useState(false);
  return (
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger>Options</DropdownMenuTrigger>
      <DropdownMenuContent size={size} sideOffset={8} collisionPadding={8}>
        <DropdownMenuLabel>Include account types</DropdownMenuLabel>
        <DropdownMenuGroup aria-label="Include account types">
          <DropdownMenuCheckboxItem checked onSelect={(event) => event.preventDefault()}>
            Human
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked="indeterminate">Some</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={bot}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => setBot(checked === true)}
          >
            Bot
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="consumer-separator" />
        <DropdownMenuLabel inset>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" onSelect={(event) => event.preventDefault()}>
            Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuItem inset>Export CSV</DropdownMenuItem>
        <DropdownMenuItem disabled>Archive</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenuContent', () => {
  it('sizes to its items by default and closes at once', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent className="consumer-menu">
          <DropdownMenuItem>Copy link</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('data-size', 'auto');
    expect(menu).toHaveClass('consumer-menu', 'rounded-md', 'p-1', 'shadow-md');
    const item = screen.getByRole('menuitem', { name: 'Copy link' });
    expect(item).toHaveClass('min-h-8', 'pointer-coarse:min-h-10', 'text-body', 'font-medium');
    expect(item).toHaveClass('rounded-sm', 'data-[highlighted]:bg-accent');
    expect(item).not.toHaveClass('pl-8');
    await user.click(item);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it.each(['sm', 'md', 'lg'] as const)(
    'draws checkbox, radio, label and separator rows at the %s size',
    async (size) => {
      const user = userEvent.setup();
      render(<Menu size={size} />);
      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('data-size', size);

      const human = screen.getByRole('menuitemcheckbox', { name: 'Human' });
      const some = screen.getByRole('menuitemcheckbox', { name: 'Some' });
      const bot = screen.getByRole('menuitemcheckbox', { name: 'Bot' });
      expect(human).toHaveAttribute('aria-checked', 'true');
      expect(some).toHaveAttribute('aria-checked', 'mixed');
      expect(bot).toHaveAttribute('aria-checked', 'false');
      // The box is always drawn; the glyph appears only when checked or mixed.
      for (const row of [human, some, bot]) {
        expect(row).toHaveClass('pl-8');
        expect(row.firstElementChild).toHaveAttribute('aria-hidden', 'true');
      }
      expect(human.firstElementChild!.querySelector('svg')).toHaveClass('lucide-check');
      expect(some.firstElementChild!.querySelector('svg')).toHaveClass('lucide-minus');
      expect(bot.firstElementChild!.querySelector('svg')).toBeNull();
      await user.click(bot);
      expect(bot).toHaveAttribute('aria-checked', 'true');
      expect(bot.firstElementChild!.querySelector('svg')).toHaveClass('lucide-check');

      expect(screen.getByText('Include account types')).toHaveClass(
        'text-overline',
        'font-semibold',
        'uppercase',
        'text-muted-foreground',
      );
      expect(screen.getByText('Include account types')).not.toHaveClass('pl-8');
      expect(screen.getByText('Appearance')).toHaveClass('pl-8');
      expect(within(menu).getByRole('separator')).toHaveClass('consumer-separator', 'bg-border');

      const dark = screen.getByRole('menuitemradio', { name: 'Dark' });
      expect(screen.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await user.click(dark);
      expect(dark).toHaveAttribute('aria-checked', 'true');
      expect(dark.firstElementChild!.querySelector('span')).toBeInTheDocument();

      expect(screen.getByRole('menuitem', { name: 'Export CSV' })).toHaveClass('pl-8');
      expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveAttribute(
        'data-disabled',
        '',
      );
    },
  );

  it('marks a scroll group as a direct row of the menu, between rows that stay in view', () => {
    render(
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger>Account type</DropdownMenuTrigger>
        <DropdownMenuContent size="sm">
          <DropdownMenuLabel>Include account types</DropdownMenuLabel>
          <DropdownMenuScrollGroup aria-label="Account types">
            <DropdownMenuCheckboxItem checked>Human</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={false}>Bot</DropdownMenuCheckboxItem>
          </DropdownMenuScrollGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Apply account types</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const menu = screen.getByRole('menu');
    const group = screen.getByRole('group', { name: 'Account types' });
    expect(group).toHaveAttribute('data-slot', 'menu-scroll-group');
    expect(group.parentElement).toBe(menu);
    expect(within(group).getAllByRole('menuitemcheckbox')).toHaveLength(2);
    expect(within(group).queryByRole('menuitem')).toBeNull();
    expect(screen.getByText('Include account types').parentElement).toBe(menu);
    expect(screen.getByRole('menuitem', { name: 'Apply account types' }).parentElement).toBe(menu);
  });

  it('portals into the given container', () => {
    const container = document.createElement('div');
    document.body.append(container);
    try {
      render(
        <DropdownMenu defaultOpen modal={false}>
          <DropdownMenuTrigger>Columns</DropdownMenuTrigger>
          <DropdownMenuContent container={container}>
            <DropdownMenuItem>Name</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      expect(within(container).getByRole('menu')).toBeInTheDocument();
    } finally {
      container.remove();
    }
  });
});
