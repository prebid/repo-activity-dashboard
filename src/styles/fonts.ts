import localFont from 'next/font/local';

// Each family lists latin-ext before latin, so the latin face takes precedence for shared characters.
export const inter = localFont({
  src: [
    { path: './fonts/inter/inter-latin-ext.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/inter/inter-latin.woff2', weight: '100 900', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
});
export const monaSans = localFont({
  src: [
    { path: './fonts/mona-sans/mona-sans-latin-ext.woff2', weight: '200 900', style: 'normal' },
    { path: './fonts/mona-sans/mona-sans-latin.woff2', weight: '200 900', style: 'normal' },
  ],
  variable: '--font-mona',
  display: 'swap',
  // Display text falls back to the preloaded Inter, not to an Arial face sized for Mona.
  adjustFontFallback: false,
  // The wdth axis lets display text render at the specified 112% width.
  declarations: [{ prop: 'font-stretch', value: '75% 125%' }],
});
/** Classes that define --font-inter and --font-mona; they belong on <html>. */
export const fontVariables = inter.variable + ' ' + monaSans.variable;
