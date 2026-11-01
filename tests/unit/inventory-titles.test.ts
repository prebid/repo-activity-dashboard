import type { Metadata } from 'next';
import { beforeEach, expect, it, vi } from 'vitest';
const getViewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ getViewer }));
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
import * as rootLayout from '@/app/layout';
import * as repositories from '@/app/(dashboard)/repos/page';
import * as repository from '@/app/(dashboard)/repos/[slug]/page';
import * as author from '@/app/(dashboard)/repos/[slug]/authors/[account]/page';
import * as contributors from '@/app/(dashboard)/contributors/page';
import * as contributor from '@/app/(dashboard)/contributors/[accountId]/page';
import * as companies from '@/app/(dashboard)/companies/page';
import * as company from '@/app/(dashboard)/companies/[...identity]/page';
import * as foundation from '@/app/(dashboard)/foundation/page';
import * as signIn from '@/app/auth/login/page';
import * as signInError from '@/app/auth/error/page';
import * as setup from '@/app/auth/setup/page';
import * as changePassword from '@/app/auth/change-password/page';
import { inventory, type InventoryView } from '../support/views';
import { pageTitles } from '../support/page-titles';

type SearchParams = Promise<Record<string, string | string[]>>;
type Route = [RegExp, (segments: string[], searchParams: SearchParams) => Promise<Metadata>];
const fixed = (metadata: Metadata) => () => Promise.resolve(metadata);
// Each inventory pathname resolves to the page module Next.js would render for it.
const routes: Route[] = [
  [/^\/repos$/, (_, searchParams) => repositories.generateMetadata({ searchParams })],
  [
    /^\/repos\/([^/]+)$/,
    ([slug], searchParams) =>
      repository.generateMetadata({ params: Promise.resolve({ slug }), searchParams }),
  ],
  [
    /^\/repos\/([^/]+)\/authors\/([^/]+)$/,
    ([slug, account], searchParams) =>
      author.generateMetadata({ params: Promise.resolve({ slug, account }), searchParams }),
  ],
  [/^\/contributors$/, (_, searchParams) => contributors.generateMetadata({ searchParams })],
  [
    /^\/contributors\/([^/]+)$/,
    ([accountId], searchParams) =>
      contributor.generateMetadata({ params: Promise.resolve({ accountId }), searchParams }),
  ],
  [/^\/companies$/, (_, searchParams) => companies.generateMetadata({ searchParams })],
  [
    /^\/companies\/(.+)$/,
    ([identity], searchParams) =>
      company.generateMetadata({
        params: Promise.resolve({ identity: identity.split('/') }),
        searchParams,
      }),
  ],
  [/^\/foundation$/, fixed(foundation.metadata)],
  [/^\/auth\/login$/, fixed(signIn.metadata)],
  [/^\/auth\/error$/, fixed(signInError.metadata)],
  [/^\/auth\/setup$/, fixed(setup.metadata)],
  [/^\/auth\/change-password$/, fixed(changePassword.metadata)],
];
async function titleOf(view: InventoryView) {
  const url = new URL(view.path, 'https://dashboard.invalid');
  const route = routes.find(([pattern]) => pattern.test(url.pathname));
  if (!route) throw Error('No page module for ' + url.pathname);
  const searchParams: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    searchParams[key] = values.length === 1 ? values[0] : values;
  }
  const metadata = await route[1](
    route[0].exec(url.pathname)!.slice(1),
    Promise.resolve(searchParams),
  );
  return metadata.title ?? rootLayout.metadata.title;
}
beforeEach(() => {
  getViewer.mockReset().mockResolvedValue({
    kind: 'authenticated',
    user: { id: 'viewer', email: 'viewer@example.test', role: 'user', authVersion: 1 },
  });
});

it('gives every inventory page group one title that no other group shares', () => {
  const groups = new Set(inventory.map((view) => view.page));
  expect(Object.keys(pageTitles).sort()).toEqual([...groups].sort());
  expect(new Set(Object.values(pageTitles)).size).toBe(groups.size);
});
it.each(inventory.map((view) => [view.id, view] as const))(
  'renders the page-group title for %s',
  async (_, view) => {
    expect(await titleOf(view)).toBe(pageTitles[view.page as keyof typeof pageTitles]);
  },
);
it('falls back to the default title on the root redirect', async () => {
  expect(rootLayout.metadata.title).toBe('Prebid');
  expect(Object.keys(await import('@/app/page'))).not.toContain('metadata');
  expect(Object.keys(await import('@/app/page'))).not.toContain('generateMetadata');
});
