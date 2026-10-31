import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/models/accounts';
import DashboardLayout from '@/app/(dashboard)/layout';

const { requireViewer, savedWidth } = vi.hoisted(() => ({
  requireViewer: vi.fn(),
  savedWidth: { value: undefined as string | undefined },
}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer }));
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'dashboard-layout-width' && savedWidth.value !== undefined
          ? { name, value: savedWidth.value }
          : undefined,
    }),
}));
afterEach(() => {
  savedWidth.value = undefined;
});
vi.mock('@/components/layout/toolbar', () => ({ Toolbar: () => <header>Navigation</header> }));

it('keeps the main landmark stable while resetting page state for an account or revision change', async () => {
  const user = userEvent.setup();
  const viewer: AuthenticatedUser = {
    id: 'alice',
    email: 'alice@example.test',
    role: 'user',
    authVersion: 1,
  };
  function Draft() {
    const [value, setValue] = useState('');
    return (
      <input
        aria-label="Page draft"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    );
  }
  async function layout(identity: AuthenticatedUser) {
    requireViewer.mockResolvedValue(identity);
    return DashboardLayout({ children: <Draft /> });
  }
  const view = render(await layout(viewer));
  const main = screen.getByRole('main');
  await user.type(screen.getByRole('textbox', { name: 'Page draft' }), 'private draft');
  view.rerender(await layout({ ...viewer }));
  expect(screen.getByRole('textbox')).toHaveValue('private draft');
  expect(screen.getByRole('main')).toBe(main);
  view.rerender(await layout({ ...viewer, authVersion: 2 }));
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(screen.getByRole('main')).toBe(main);
  await user.type(screen.getByRole('textbox'), 'another draft');
  view.rerender(await layout({ ...viewer, id: 'bob', email: 'bob@example.test' }));
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(screen.getByRole('main')).toBe(main);
});
it.each([
  [undefined, 'wide'],
  ['contained', 'contained'],
  ['unexpected', 'wide'],
])('renders a saved layout width of %j as %s on the server', async (saved, width) => {
  savedWidth.value = saved;
  requireViewer.mockResolvedValue({
    id: 'alice',
    email: 'alice@example.test',
    role: 'user',
    authVersion: 1,
  } satisfies AuthenticatedUser);
  const { container } = render(await DashboardLayout({ children: <p>Report</p> }));
  expect(container.querySelector('[data-layout-width]')).toHaveAttribute(
    'data-layout-width',
    width,
  );
});
