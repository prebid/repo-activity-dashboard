import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The type roles from globals.css @theme are sizes; unregistered, tailwind-merge reads
// text-body as a colour and drops it next to a text colour class.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'title', 'kpi', 'heading', 'body', 'small', 'caption', 'overline'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
