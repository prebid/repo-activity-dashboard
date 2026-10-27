'use client';
import { ThemeProvider as Provider } from 'next-themes';
export { useTheme } from 'next-themes';
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider attribute="class" defaultTheme="dark" storageKey="dashboard-theme" enableSystem disableTransitionOnChange>
      {children}
    </Provider>
  );
}
