'use client';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { EdgeFrame, EdgeMessage } from '@/components/layout/edge-frame';
import { fontVariables } from '@/styles/fonts';
// This page replaces the root layout, so it brings the stylesheet, fonts and saved theme itself.
export default function GlobalError() {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider>
          <EdgeFrame>
            <EdgeMessage
              title="The application could not load"
              action={
                <Button variant="primary" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              }
            />
          </EdgeFrame>
        </ThemeProvider>
      </body>
    </html>
  );
}
