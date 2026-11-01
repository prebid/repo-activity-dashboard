import './globals.css';
import type { Metadata } from 'next';
import { defaultPageTitle } from '@/lib/presentation/page-title';
import { AuthTransitions } from '@/components/providers/auth-transitions';
import { ThemeProvider } from '@/components/providers/theme-provider';
export const metadata: Metadata = {
  title: defaultPageTitle,
  description: 'Repository activity frontend',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider>
          <AuthTransitions />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
