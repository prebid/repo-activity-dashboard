'use client';

import * as React from 'react';

import { CheckIcon, IndeterminateIcon } from '@/components/ui/icons';

export interface CheckboxProps extends Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'className' | 'type' | 'size'
> {
  /** A mixed state, such as a group whose members are partly selected. */
  indeterminate?: boolean;
}

/**
 * A 16px checkbox: the field edge, and the selection edge colour when checked or mixed. The glyph
 * shares the input's grid cell and follows its state through peer-* variants.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { indeterminate = false, ...props },
  forwarded,
) {
  const local = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(forwarded, () => local.current!, []);
  React.useEffect(() => {
    // indeterminate is a DOM property with no attribute.
    local.current!.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <span className="inline-grid size-4 shrink-0 align-middle" data-slot="checkbox">
      <input
        {...props}
        ref={local}
        type="checkbox"
        className="peer col-start-1 row-start-1 m-0 size-4 cursor-pointer appearance-none rounded-sm border border-input bg-(--prebid-input) focus-ring checked:border-selection-edge checked:bg-selection-edge indeterminate:border-selection-edge indeterminate:bg-selection-edge disabled:cursor-not-allowed disabled:opacity-50"
      />
      {/* Only the glyph the input can show: the mixed state is set from the prop, so a box that is
          not indeterminate never needs the dash, and long option lists render one svg per box. */}
      {indeterminate ? (
        <span className="pointer-events-none col-start-1 row-start-1 hidden place-items-center text-card peer-indeterminate:grid peer-disabled:opacity-50">
          <IndeterminateIcon size={14} />
        </span>
      ) : (
        <span className="pointer-events-none col-start-1 row-start-1 hidden place-items-center text-card peer-checked:grid peer-disabled:opacity-50">
          <CheckIcon size={14} />
        </span>
      )}
    </span>
  );
});
