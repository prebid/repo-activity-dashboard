import { beforeEach, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { ThemeMenu } from '@/components/layout/theme-menu';

const theme = vi.hoisted(() => ({ value: undefined as string | undefined, set: vi.fn() }));
vi.mock('@/components/providers/theme-provider', () => ({
  useTheme: () => ({ theme: theme.value, setTheme: theme.set }),
}));
beforeEach(() => {
  theme.value = undefined;
  theme.set.mockReset();
});

it.each(['system', 'light', 'dark'])(
  'hydrates a saved %s preference without replacing server markup',
  async (preference) => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<ThemeMenu className="consumer-theme" />);
    document.body.append(container);
    const serverButton = container.querySelector('button')!;
    expect(serverButton).toBeDisabled();
    theme.value = preference;
    const recover = vi.fn();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root: Root | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, <ThemeMenu className="consumer-theme" />, {
          onRecoverableError: recover,
        });
      });
      expect(container.querySelector('button')).toBe(serverButton);
      await waitFor(() => expect(serverButton).toBeEnabled());
      expect(serverButton).toHaveClass('consumer-theme');
      expect(serverButton).toHaveAccessibleName('Theme settings');
      expect(recover).not.toHaveBeenCalled();
      expect(errors).not.toHaveBeenCalled();
      expect(theme.set).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
      errors.mockRestore();
    }
  },
);
