import type { Preview } from '@storybook/nextjs-vite';
import { useEffect, type ReactNode } from 'react';
import '../src/app/globals.css';
function ThemeFrame({ dark, children }: { dark: boolean; children: ReactNode }) {
  useEffect(() => {
    // Portals render under body, outside the story wrapper.
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);
  return <div className="min-h-screen bg-background p-6 text-foreground">{children}</div>;
}
const preview: Preview = {
  globalTypes: {
    theme: { description: 'Theme', toolbar: { icon: 'circlehollow', items: ['light', 'dark'] } },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => (
      <ThemeFrame dark={context.globals.theme === 'dark'}>
        <Story />
      </ThemeFrame>
    ),
  ],
};
export default preview;
