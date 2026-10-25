import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';
const preview: Preview = {
  globalTypes: {
    theme: { description: 'Theme', toolbar: { icon: 'circlehollow', items: ['light', 'dark'] } },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => (
      <div className={context.globals.theme === 'dark' ? 'dark' : ''}>
        <div className="min-h-screen bg-background p-6 text-foreground">
          <Story />
        </div>
      </div>
    ),
  ],
};
export default preview;
