import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { repositoryCatalog } from '@/config/repositories';

vi.mock('next/image', () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));
function header(activePath: string) {
  return render(
    <DashboardHeader
      repositories={repositoryCatalog}
      activePath={activePath}
      accountControls={null}
    />,
  );
}
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
it('lists exactly the enabled repositories in the Repositories menu', async () => {
  header('/repos');
  await userEvent.click(screen.getByRole('button', { name: /Repositories/ }));
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(
    repositoryCatalog.filter((repo) => repo.enabled).map((repo) => repo.displayName),
  );
});
