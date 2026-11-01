'use client';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { fontVariables } from '@/styles/fonts';
// This page replaces the root layout, so it brings the stylesheet, fonts and saved theme itself.
export default function GlobalError() {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider>
          <h1>The application could not load</h1>
          <button onClick={() => window.location.reload()}>Try again</button>
        </ThemeProvider>
      </body>
    </html>
  );
}
