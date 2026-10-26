import type { Preview } from '@storybook/nextjs-vite';
import { useEffect, useRef, type ReactNode } from 'react';
import { ThemeProvider, useTheme } from '../src/components/providers/theme-provider';
import '../src/app/globals.css';
function ThemeFrame({ theme, children }: { theme: string; children: ReactNode }) {
  const { setTheme } = useTheme();
  const appliedTheme = useRef<string | null>(null);
  useEffect(() => {
    // Only a catalog-toolbar change should override a choice made through the page menu.
    if (appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    setTheme(theme);
  }, [theme, setTheme]);
  return <div className="min-h-screen bg-background p-6 text-foreground">{children}</div>;
}
const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { icon: 'circlehollow', items: ['system', 'light', 'dark'] },
    },
  },
  initialGlobals: { theme: 'system' },
  decorators: [
    (Story, context) => (
      <ThemeProvider>
        <ThemeFrame
          theme={
            context.globals.theme === 'light'
              ? 'light'
              : context.globals.theme === 'dark'
                ? 'dark'
                : 'system'
          }
        >
          <Story />
        </ThemeFrame>
      </ThemeProvider>
    ),
  ],
};
export default preview;
