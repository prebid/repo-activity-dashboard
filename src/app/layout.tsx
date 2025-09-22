import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '../components/providers/theme-provider';
import { AuthSessionProvider } from '../components/providers/session-provider';
import { Toolbar } from '../components/layout/toolbar';

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
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AuthSessionProvider>
          <ThemeProvider defaultTheme="system">
            <Toolbar />
            <main className="flex-1">
              {children}
            </main>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}