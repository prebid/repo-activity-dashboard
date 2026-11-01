'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { CloseIcon } from '@/components/ui/icons';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

/** Widths before the 100vw - 32px cap: sm 512px, md 640px, lg 680px. */
export type DialogSize = 'sm' | 'md' | 'lg';

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    container?: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>['container'];
    size?: DialogSize;
  }
>(({ className, children, container, size = 'sm', ...props }, ref) => (
  <DialogPortal container={container}>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-size={size}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-32px)] max-h-[calc(100svh-32px)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border bg-overlay p-6 text-foreground shadow-lg duration-200 [@media(max-width:600px)]:p-5',
        'data-[size=sm]:max-w-[512px] data-[size=md]:max-w-[640px] data-[size=lg]:max-w-[680px]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        className,
      )}
      {...props}
    >
      {children}
      {/* Last in the DOM, so a dialog opens on its own first control rather than on Close. */}
      <DialogPrimitive.Close asChild>
        <Button variant="ghost" size="icon" className="absolute right-3 top-3">
          <CloseIcon size={16} />
          <span className="sr-only">Close</span>
        </Button>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    // The right padding keeps a wrapping title clear of the close button. tailwind-merge reads
    // font-stretch-(--name) as a font family and drops font-display, so the stretch is bracketed.
    className={cn(
      'pr-8 font-display text-title font-bold font-stretch-[var(--prebid-display-stretch)]',
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-body text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
