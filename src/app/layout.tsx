import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '../components/providers/theme-provider';
import { AuthSessionProvider } from '../components/providers/session-provider';
import { SiteShell } from '../components/layout/site-shell';

export const metadata: Metadata = {
  title: 'Repository Activity Dashboard',
  description: 'GitHub repository activity tracking and analytics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{ margin: 0 }}>
        <AuthSessionProvider>
          <ThemeProvider>
            <SiteShell>{children}</SiteShell>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
