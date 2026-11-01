import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { repositoryCatalog } from '@/config/repositories';

vi.mock('next/image', () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));
function header(activePath: string, administration = false) {
  return render(
    <DashboardHeader
      repositories={repositoryCatalog}
      activePath={activePath}
      administration={administration}
      accountControls={<button type="button">Theme settings</button>}
    />,
  );
}
it('places Accounts beside the account controls for administrators only', () => {
  const viewer = header('/repos');
  expect(screen.queryByRole('link', { name: 'Accounts' })).not.toBeInTheDocument();
  viewer.unmount();
  header('/admin/users', true);
  const main = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(within(main).queryByRole('link', { name: 'Accounts' })).not.toBeInTheDocument();
  const administration = screen.getByRole('navigation', { name: 'Administration' });
  const accounts = within(administration).getByRole('link', { name: 'Accounts' });
  expect(accounts).toHaveAttribute('href', '/admin/users');
  expect(accounts).toHaveAttribute('aria-current', 'page');
  // Same group, immediately before the account controls.
  expect(administration.nextElementSibling).toBe(
    screen.getByRole('button', { name: 'Theme settings' }),
  );
});
it('leads with Overview and marks only the active main-navigation destination', () => {
  const overview = header('/repos');
  const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(
    [...navigation.querySelectorAll('a, button')].map((item) => item.textContent?.trim()),
  ).toEqual(['Overview', 'Repositories', 'Contributions']);
  expect(within(navigation).getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(within(navigation).getByRole('button', { name: /Repositories/ })).toHaveAttribute(
    'data-active',
    'false',
  );
  overview.unmount();
  header('/repos/prebidjs');
  const repositories = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(within(repositories).getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
    'aria-current',
  );
  expect(within(repositories).getByRole('button', { name: /Repositories/ })).toHaveAttribute(
    'data-active',
    'true',
  );
});
it.each([
  ['/repos', 'false', false],
  ['/contributors', 'true', true],
  ['/contributors/account-alice', 'true', false],
  ['/companies', 'true', false],
])('marks Contributions on %s as active=%s, current=%s', (path, active, current) => {
  header(path);
  const contributions = screen.getByRole('link', { name: 'Contributions' });
  expect(contributions).toHaveAttribute('data-active', active);
  if (current) expect(contributions).toHaveAttribute('aria-current', 'page');
  else expect(contributions).not.toHaveAttribute('aria-current');
});
it('lists exactly the enabled repositories in the Repositories menu', async () => {
  header('/repos');
  await userEvent.click(screen.getByRole('button', { name: /Repositories/ }));
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(
    repositoryCatalog.filter((repo) => repo.enabled).map((repo) => repo.displayName),
  );
});
it('gives each header destination an idle pending indicator, but not the menu items that close on click', async () => {
  header('/repos', true);
  for (const name of ['Repository activity', 'Overview', 'Contributions', 'Accounts'])
    expect(screen.getByRole('link', { name }).lastElementChild).toHaveAttribute(
      'data-pending',
      'false',
    );
  await userEvent.click(screen.getByRole('button', { name: /Repositories/ }));
  for (const item of screen.getAllByRole('menuitem'))
    expect(item.querySelector('[data-link-pending]')).toBeNull();
});
