import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Every variant draws a 1px border so the sizes match across variants. Icons are sized by their
// own size prop: 14 at sm and md, 16 at lg.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Orange: the one action a surface asks for. */
        primary:
          'border-action-border bg-action text-action-foreground shadow-sm hover:bg-action-hover active:bg-action-pressed',
        /** aria-pressed or an open menu or dialog shows the selected state with a 2px edge as well as
            colour. The label keeps its weight, so a pressed or open button never changes width and
            a toolbar row near its limit does not wrap when a menu opens. */
        secondary:
          'border-input bg-overlay text-foreground shadow-sm hover:border-brand hover:bg-accent aria-pressed:border-selection-edge aria-pressed:bg-selection aria-pressed:inset-ring aria-pressed:inset-ring-selection-edge aria-pressed:text-selection-foreground data-[state=open]:border-selection-edge data-[state=open]:bg-selection data-[state=open]:inset-ring data-[state=open]:inset-ring-selection-edge data-[state=open]:text-selection-foreground',
        ghost: 'border-transparent text-foreground hover:bg-ghost-hover',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
      },
      size: {
        sm: 'h-7 px-2.5 text-small pointer-coarse:h-10',
        md: 'h-[34px] px-3 text-body pointer-coarse:h-10',
        lg: 'h-10 px-4 text-body',
        'icon-sm': 'size-7 pointer-coarse:size-10',
        icon: 'size-[34px] pointer-coarse:size-10',
      },
    },
    // Inter 700 belongs to the one primary lg use, the authentication submits.
    compoundVariants: [
      { variant: 'primary', size: 'lg', class: 'font-bold' },
      // An icon-only ghost button (help, close, remove) stays quiet beside labelled controls.
      {
        variant: 'ghost',
        size: ['icon-sm', 'icon'],
        class: 'text-muted-foreground hover:text-foreground',
      },
    ],
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
