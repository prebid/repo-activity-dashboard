import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/** The three control heights, 28, 34 and 40px; every size is 40px on a coarse pointer. */
export type ControlSize = 'sm' | 'md' | 'lg';

// Field text is 16px on coarse pointers so iOS does not zoom into a focused field.
export const fieldVariants = cva(
  'w-full min-w-0 rounded-md border border-input bg-(--prebid-input) font-normal text-foreground transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50 dark:scheme-dark pointer-coarse:h-10 pointer-coarse:text-(length:--prebid-text-input-coarse)',
  {
    variants: {
      size: {
        sm: 'h-7 px-2.5 text-small',
        md: 'h-[34px] px-3 text-body',
        lg: 'h-10 px-3 text-body',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface InputProps extends Omit<React.ComponentProps<'input'>, 'size'> {
  size?: ControlSize;
  /** mono sets a value meant to be read character by character, such as a generated password. */
  font?: 'sans' | 'mono';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, font = 'sans', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldVariants({ size }),
          'placeholder:text-placeholder file:border-0 file:bg-transparent file:font-medium file:text-foreground',
          font === 'mono' && 'font-mono',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
