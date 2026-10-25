import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AuthSessionProvider } from '@/components/providers/session-provider';
import { Toolbar } from '@/components/layout/toolbar';
import { repositoryCatalog } from '@/config/repositories';
export const metadata: Metadata = {
  title: 'Repository activity',
  description: 'Repository activity frontend',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <AuthSessionProvider>
          <ThemeProvider>
            <Toolbar repositories={repositoryCatalog} />
            <aside
              aria-label="Data source"
              className="border-b bg-muted px-4 py-2 text-center text-sm"
            >
              Sample data · Frontend foundation preview
            </aside>
            <main className="mx-auto max-w-screen-2xl space-y-6 p-4 md:p-8">{children}</main>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
