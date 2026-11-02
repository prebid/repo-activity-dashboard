import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu, accountRoleLabels } from '@/components/layout/account-menu';
import type { AuthenticatedUser } from '@/models/accounts';

const alice = { name: 'Alice (sample)', email: 'alice@example.test', role: 'viewer' } as const;

function menu(viewer: Pick<AuthenticatedUser, 'name' | 'email' | 'role'>, passwordChange = false) {
  const view = render(
    <header>
      <AccountMenu viewer={viewer} passwordChange={passwordChange} />
    </header>,
  );
  return { trigger: screen.getByRole('button', { name: /^Account: / }), unmount: view.unmount };
}

it('names its trigger after the account and shows the name, email and role', async () => {
  const user = userEvent.setup();
  const { trigger } = menu(alice);
  expect(trigger).toHaveAccessibleName('Account: Alice (sample)');
  expect(trigger).toHaveTextContent('Alice (sample)');
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await user.click(trigger);
  const content = screen.getByRole('menu', { name: 'Account: Alice (sample)' });
  expect(content).toHaveTextContent('Alice (sample)alice@example.testRole: Viewer');
  // The popup stays inside the masthead landmark.
  expect(screen.getByRole('banner')).toContainElement(content);
});

it('describes the opened menu with the email and role, which are text rather than items', async () => {
  const user = userEvent.setup();
  await user.click(menu({ ...alice, role: 'admin' }, true).trigger);
  expect(screen.getByRole('menu', { name: 'Account: Alice (sample)' })).toHaveAccessibleDescription(
    'alice@example.test Role: Administrator',
  );
});

it('offers Change password as a link to the existing page only where the build allows it', async () => {
  const user = userEvent.setup();
  const preview = menu(alice);
  await user.click(preview.trigger);
  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(screen.queryByText('Change password')).not.toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(preview.trigger).toHaveFocus();
  preview.unmount();

  const production = menu(alice, true);
  production.trigger.focus();
  await user.keyboard('{Enter}');
  const item = screen.getByRole('menuitem', { name: 'Change password' });
  expect(item).toHaveAttribute('href', '/auth/change-password');
  expect(item).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(production.trigger).toHaveFocus();
});

it.each(Object.entries(accountRoleLabels))('reads the %s role as %s', async (role, label) => {
  const user = userEvent.setup();
  await user.click(menu({ ...alice, role: role as keyof typeof accountRoleLabels }).trigger);
  expect(within(screen.getByRole('menu')).getByText('Role: ' + label)).toBeInTheDocument();
});

it('falls back to the email where the account has no name', async () => {
  const user = userEvent.setup();
  const { trigger } = menu({ email: 'fixture@example.test', role: 'admin' });
  expect(trigger).toHaveAccessibleName('Account: fixture@example.test');
  await user.click(trigger);
  expect(screen.getByRole('menu')).toHaveTextContent(
    'fixture@example.testfixture@example.testRole: Administrator',
  );
});
