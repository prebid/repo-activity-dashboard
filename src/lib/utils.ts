import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge, validators } from 'tailwind-merge';

// The theme's type roles, display font and stretch variable are unknown to tailwind-merge's
// defaults: it reads text-body as a colour and font-stretch-(--x) as a font family, and drops
// the class each appears to replace.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'title', 'kpi', 'heading', 'body', 'small', 'caption', 'overline'],
      font: ['display'],
    },
    classGroups: {
      'font-stretch': [{ 'font-stretch': [validators.isArbitraryVariable] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
