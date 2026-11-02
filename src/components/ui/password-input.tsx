'use client';

import { forwardRef, useId, useState, type ComponentPropsWithoutRef } from 'react';
import { HidePasswordIcon, ShowPasswordIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';

// No className: a caller sets the field's look through Input's props, as rule 3 requires.
type PasswordInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, 'type' | 'className'> & {
  visibilityLabel?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ visibilityLabel = 'password', id, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative" data-slot="password-field">
        <Input
          {...props}
          id={inputId}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className="pr-12"
        />
        <button
          type="button"
          data-slot="password-toggle"
          className="absolute inset-y-0.5 right-0.5 grid w-[43px] place-items-center rounded-sm text-muted-foreground hover:bg-ghost-hover focus-ring disabled:cursor-default disabled:opacity-50"
          aria-label={`${visible ? 'Hide' : 'Show'} ${visibilityLabel}`}
          aria-pressed={visible}
          aria-controls={inputId}
          disabled={props.disabled}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <HidePasswordIcon size={16} /> : <ShowPasswordIcon size={16} />}
        </button>
      </div>
    );
  },
);
