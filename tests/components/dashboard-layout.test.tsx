import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/models/accounts';
import DashboardLayout from '@/app/(dashboard)/layout';

const { requireViewer } = vi.hoisted(() => ({ requireViewer: vi.fn() }));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer }));
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
