import * as React from 'react';

import { SearchIcon } from '@/components/ui/icons';
import { Input, type InputProps } from '@/components/ui/input';

export type SearchFieldProps = Omit<InputProps, 'className' | 'type'>;

/**
 * A text field with a leading search icon. It stays type="text", so it keeps the textbox role.
 * Width comes from the caller's wrapper.
 */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(props, ref) {
    return (
      <span className="relative block w-full" data-slot="search-field">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
          <SearchIcon size={14} />
        </span>
        <Input {...props} ref={ref} type="text" className="pl-[30px]" />
      </span>
    );
  },
);
