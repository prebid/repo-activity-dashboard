import { startTransition } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { repositoryCatalog } from '@/config/repositories';

const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/image', () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));
afterEach(() => router.push.mockReset());
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
/** Stands in for the App Router, whose push stays in its transition until the destination commits. */
function holdNavigation() {
  let commit!: () => void;
  const destination = new Promise<void>((resolve) => {
    commit = resolve;
  });
  router.push.mockImplementation(() => startTransition(() => destination));
  return () =>
    act(async () => {
      commit();
      await destination;
    });
}
const enabled = repositoryCatalog.filter((repo) => repo.enabled);

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
  expect(within(navigation).getByRole('button', { name: 'Repositories' })).toHaveAttribute(
    'data-active',
    'false',
  );
  overview.unmount();
  header('/repos/prebidjs');
  const repositories = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(within(repositories).getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
    'aria-current',
  );
  expect(within(repositories).getByRole('button', { name: 'Repositories' })).toHaveAttribute(
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
it('lists exactly the enabled repositories in the Repositories menu and marks the current one', async () => {
  header('/repos/prebidjs');
  await userEvent.click(screen.getByRole('button', { name: 'Repositories' }));
  const items = screen.getAllByRole('menuitem');
  expect(items.map((item) => item.textContent)).toEqual(enabled.map((repo) => repo.displayName));
  expect(items.map((item) => item.getAttribute('href'))).toEqual(
    enabled.map((repo) => '/repos/' + repo.slug),
  );
  expect(screen.getByRole('menuitem', { name: 'Prebid.js' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
it('gives each header destination an idle pending indicator, but not the menu items that close on click', async () => {
  header('/repos', true);
  for (const name of ['Repository activity', 'Overview', 'Contributions', 'Accounts'])
    expect(screen.getByRole('link', { name }).lastElementChild).toHaveAttribute(
      'data-pending',
      'false',
    );
  const trigger = screen.getByRole('button', { name: 'Repositories' });
  expect(trigger.lastElementChild).toHaveAttribute('data-pending', 'false');
  await userEvent.click(trigger);
  for (const item of screen.getAllByRole('menuitem'))
    expect(item.querySelector('[data-link-pending]')).toBeNull();
});
it('closes the Repositories menu on a choice and marks its trigger until the repository arrives', async () => {
  const user = userEvent.setup();
  const commit = holdNavigation();
  header('/repos');
  const trigger = screen.getByRole('button', { name: 'Repositories' });
  await user.click(trigger);
  await user.click(screen.getByRole('menuitem', { name: 'Prebid.js' }));
  expect(router.push).toHaveBeenCalledExactlyOnceWith('/repos/prebidjs');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger.lastElementChild).toHaveAttribute('data-pending', 'true');
  await commit();
  expect(trigger.lastElementChild).toHaveAttribute('data-pending', 'false');
});
it('follows a keyboard choice the same way', async () => {
  const user = userEvent.setup();
  const commit = holdNavigation();
  header('/repos');
  const trigger = screen.getByRole('button', { name: 'Repositories' });
  trigger.focus();
  await user.keyboard('{Enter}');
  expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(router.push).toHaveBeenCalledExactlyOnceWith('/repos/' + enabled[0].slug);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await commit();
});
it('leaves a modified click on a repository to the browser', async () => {
  const user = userEvent.setup();
  header('/repos');
  await user.click(screen.getByRole('button', { name: 'Repositories' }));
  const item = screen.getByRole('menuitem', { name: 'Prebid.js' });
  // The browser would open the link elsewhere; jsdom implements no navigation, so the default
  // action is cancelled after the page's own handlers have seen the click.
  let leftToBrowser = false;
  const cancel = (event: MouseEvent) => {
    leftToBrowser = !event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', cancel);
  try {
    fireEvent(item, new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
  } finally {
    document.removeEventListener('click', cancel);
  }
  expect(leftToBrowser).toBe(true);
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Repositories' }).lastElementChild).toHaveAttribute(
    'data-pending',
    'false',
  );
});
