import * as React from 'react';

import { ExpandIcon } from '@/components/ui/icons';
import { fieldVariants, type ControlSize } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface NativeSelectProps extends Omit<
  React.ComponentPropsWithoutRef<'select'>,
  'className' | 'size' | 'multiple'
> {
  size?: ControlSize;
}

/** A native select with the field edge and one chevron. Width comes from the caller's wrapper. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  function NativeSelect({ size, children, ...props }, ref) {
    return (
      <span className="relative inline-grid w-full" data-slot="native-select">
        <select
          ref={ref}
          className={cn(
            fieldVariants({ size }),
            'appearance-none pr-8 font-medium enabled:cursor-pointer enabled:hover:border-brand',
          )}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground">
          <ExpandIcon size={14} />
        </span>
      </span>
    );
  },
);
