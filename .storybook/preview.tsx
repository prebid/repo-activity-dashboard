import type { Preview } from '@storybook/nextjs-vite';
import { useEffect, useRef, type ReactNode } from 'react';
import { ThemeProvider, useTheme } from '../src/components/providers/theme-provider';
import { fontVariables } from '../src/styles/fonts';
import '../src/app/globals.css';
// On <html>, like the app, so portaled menus and dialogs inherit the font variables too.
document.documentElement.classList.add(...fontVariables.split(' '));
function ThemeFrame({
  theme,
  children,
  fullBleed,
}: {
  theme: string;
  children: ReactNode;
  fullBleed: boolean;
}) {
  const { setTheme } = useTheme();
  const appliedTheme = useRef<string | null>(null);
  useEffect(() => {
    // Only a catalog-toolbar change should override a choice made through the page menu.
    if (appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    setTheme(theme);
  }, [theme, setTheme]);
  return (
    <div
      data-story-frame
      className={fullBleed ? 'min-h-screen' : 'min-h-screen bg-background p-6 text-foreground'}
    >
      {children}
    </div>
  );
}
const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { icon: 'circlehollow', items: ['system', 'light', 'dark'] },
    },
  },
  initialGlobals: { theme: 'dark' },
  decorators: [
    (Story, context) => (
      <ThemeProvider>
        <ThemeFrame
          fullBleed={context.parameters.layout === 'fullscreen'}
          theme={
            context.globals.theme === 'light'
              ? 'light'
              : context.globals.theme === 'system'
                ? 'system'
                : 'dark'
          }
        >
          <Story />
        </ThemeFrame>
      </ThemeProvider>
    ),
  ],
};
export default preview;
