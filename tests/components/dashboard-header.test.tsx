import { startTransition } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { repositoryCatalog } from '@/config/repositories';
import { PreferenceBindingProvider } from '@/lib/navigation/preference-binding';
import { alice, seedPreferences } from '../support/preference-cookies';

const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
// The router's query; null where no router provides one.
const query = vi.hoisted((): { search: string | null } => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => (query.search === null ? null : new URLSearchParams(query.search)),
}));
vi.mock('next/image', () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));
afterEach(() => {
  router.push.mockReset();
  query.search = '';
});
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
  ).toEqual(['Overview', 'Repositories', 'Contributors', 'Reviewers']);
  // Without a signed-in viewer's saved view, each lens opens its bare overview.
  expect(within(navigation).getByRole('link', { name: 'Contributors' })).toHaveAttribute(
    'href',
    '/contributors',
  );
  expect(within(navigation).getByRole('link', { name: 'Reviewers' })).toHaveAttribute(
    'href',
    '/reviewers',
  );
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
// Each row: path, query (null: no router query), then the lens link that is active, and whether
// it is also the current page.
it.each([
  ['/repos', '', null, false],
  ['/repos', 'lens=reviewers', null, false],
  ['/contributors', '', 'Contributors', true],
  ['/contributors/account-alice', '', 'Contributors', false],
  ['/companies', '', 'Contributors', false],
  ['/companies', null, 'Contributors', false],
  ['/companies/id/company-acme', 'view=repositories', 'Contributors', false],
  ['/reviewers', '', 'Reviewers', true],
  ['/reviewers', null, 'Reviewers', true],
  ['/reviewers', 'timeline', 'Reviewers', true],
  ['/contributors/account-alice', 'lens=reviewers', 'Reviewers', false],
  ['/companies', 'lens=reviewers', 'Reviewers', false],
  ['/companies/id/company-acme', 'lens=reviewers&view=repositories', 'Reviewers', false],
  // Not a Reviewers-lens spelling (the invalid view), but never two marked destinations.
  ['/contributors', 'lens=reviewers', 'Reviewers', false],
] as const)('on %s?%s marks %s (current page: %s)', (path, search, active, current) => {
  query.search = search;
  header(path);
  for (const name of ['Contributors', 'Reviewers'] as const) {
    const link = screen.getByRole('link', { name });
    expect(link, name).toHaveAttribute('data-active', String(name === active));
    if (name === active && current) expect(link, name).toHaveAttribute('aria-current', 'page');
    else expect(link, name).not.toHaveAttribute('aria-current');
  }
});
it("opens each lens in the viewer's saved view of that lens", () => {
  seedPreferences(alice, {
    'contributions.contributors.sort': { sort: 'name', descending: false },
    'contributions.reviewers.contributors.sort': { sort: 'mergesPerformed', descending: true },
  });
  render(
    <PreferenceBindingProvider binding={alice}>
      <DashboardHeader
        repositories={repositoryCatalog}
        activePath="/repos"
        viewerId="alice"
        accountControls={null}
      />
    </PreferenceBindingProvider>,
  );
  expect(screen.getByRole('link', { name: 'Contributors' })).toHaveAttribute(
    'href',
    '/contributors?sort=name',
  );
  expect(screen.getByRole('link', { name: 'Reviewers' })).toHaveAttribute(
    'href',
    '/reviewers?sort=-mergesPerformed',
  );
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
  for (const name of ['Repository activity', 'Overview', 'Contributors', 'Reviewers', 'Accounts'])
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
