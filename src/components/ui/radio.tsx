import * as React from 'react';

export type RadioProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'className' | 'type' | 'size'
>;

/**
 * A 16px radio: the field edge, and the selection edge colour with a centre dot when checked. The
 * dot shares the input's grid cell and follows its state through peer-* variants.
 */
export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(props, ref) {
  return (
    <span className="inline-grid size-4 shrink-0 align-middle" data-slot="radio">
      <input
        {...props}
        ref={ref}
        type="radio"
        className="peer col-start-1 row-start-1 m-0 size-4 cursor-pointer appearance-none rounded-full border border-input bg-(--prebid-input) focus-ring checked:border-selection-edge checked:bg-selection-edge disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="pointer-events-none col-start-1 row-start-1 hidden size-1.5 place-self-center rounded-full bg-card peer-checked:block peer-disabled:opacity-50" />
    </span>
  );
});
