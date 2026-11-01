'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { CheckIcon, IndeterminateIcon } from '@/components/ui/icons';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import styles from './dropdown-menu.module.css';

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

/** A group that scrolls when the menu runs out of height, keeping the menu's other rows in view. */
const DropdownMenuScrollGroup = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Group>,
  Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Group>, 'className'>
>((props, ref) => (
  <DropdownMenuPrimitive.Group
    ref={ref}
    data-slot="menu-scroll-group"
    {...props}
    className={styles.scrollGroup}
  />
));
DropdownMenuScrollGroup.displayName = 'DropdownMenuScrollGroup';

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/** auto fits its items from 156px; sm 240px, md 320px and lg 360px are fixed widths. */
export type DropdownMenuSize = 'auto' | 'sm' | 'md' | 'lg';

const itemClassName =
  'relative flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-body font-medium focus-ring transition-colors pointer-coarse:min-h-10 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:shrink-0';

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    container?: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Portal>['container'];
    size?: DropdownMenuSize;
  }
>(
  (
    { className, sideOffset = 4, collisionPadding = 16, size = 'auto', container, ...props },
    ref,
  ) => (
    <DropdownMenuPrimitive.Portal container={container}>
      {/* The 72svh cap keeps a long menu on screen when focusing its last item scrolls the page
          and the available height is measured again. */}
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        data-size={size}
        className={cn(
          styles.content,
          'z-50 max-h-[min(72svh,var(--radix-dropdown-menu-content-available-height))] max-w-[calc(100vw-32px)] overflow-y-auto overflow-x-hidden rounded-md border p-1 text-popover-foreground shadow-md',
          'data-[size=auto]:min-w-[156px] data-[size=sm]:w-[240px] data-[size=md]:w-[320px] data-[size=lg]:w-[360px]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[var(--radix-dropdown-menu-content-transform-origin)]',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  ),
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(itemClassName, inset && 'pl-8', className)}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

/**
 * A menu's closing action, such as Apply, drawn as a primary small button in the menu footer. It
 * stays a menu item, so arrow keys reach it and selecting it runs onSelect.
 */
const DropdownMenuAction = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>, 'className'>
>(({ children, ...props }, ref) => (
  <div className={styles.footer}>
    <DropdownMenuPrimitive.Item ref={ref} {...props} asChild>
      <Button type="button" variant="primary" size="sm">
        {children}
      </Button>
    </DropdownMenuPrimitive.Item>
  </div>
));
DropdownMenuAction.displayName = 'DropdownMenuAction';

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(itemClassName, 'pl-8', className)}
    checked={checked}
    {...props}
  >
    {/* The same box as the Checkbox field: an input-border edge, filled when checked. */}
    <span className={styles.box} aria-hidden="true">
      <DropdownMenuPrimitive.ItemIndicator>
        {checked === 'indeterminate' ? <IndeterminateIcon size={14} /> : <CheckIcon size={14} />}
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(itemClassName, 'pl-8', className)}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center" aria-hidden="true">
      <DropdownMenuPrimitive.ItemIndicator>
        <span className="block size-2 rounded-full bg-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-overline font-semibold uppercase tracking-(--prebid-tracking-overline) text-muted-foreground',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuAction,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuScrollGroup,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
};
