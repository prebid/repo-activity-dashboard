import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const redirect = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { href });
  }),
);
vi.mock('next/navigation', () => ({
  redirect,
  notFound: () => {
    throw Error('not-found');
  },
}));
vi.mock('@/lib/auth/viewer', () => ({
  requireViewer: () => Promise.resolve({ id: 'alice', authVersion: 0 }),
}));
vi.mock('@/server/preferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/preferences')>();
  const { rawPreferenceCookie, alice } = await import('../support/preference-cookies');
  return {
    ...actual,
    readPreferences: (cookie: 'repositories' | 'contributions') =>
      Promise.resolve(actual.preferenceSnapshot(cookie, alice, rawPreferenceCookie(cookie))),
  };
});
import { canonicalPage, oversizedLinkMessage } from '@/server/canonical-page';
import { timelineEntryValues } from '@/server/timeline-preview';
import { readPreferences } from '@/server/preferences';
import type { UrlRoute, UrlSegments, UrlValues } from '@/lib/presentation/url/registry';
import { serializeTimelinePreferences } from '@/lib/presentation/timeline-controls';
import { alice, clearPreferenceCookies, seedPreferences } from '../support/preference-cookies';

/** The 307 target the helper answers with, or the page it lets render. */
async function answer(...args: Parameters<typeof canonicalPage>) {
  try {
    return await canonicalPage(...args);
  } catch (error) {
    return { redirect: (error as { href: string }).href };
  }
}
const timelineSection = (query: string, area: 'matrix' | 'repository') =>
  JSON.parse(serializeTimelinePreferences(new URLSearchParams(query), area)) as unknown;
afterEach(() => {
  clearPreferenceCookies();
  redirect.mockClear();
});

describe('canonicalPage', () => {
  it('answers a legacy link with a 307 to its canonical form', async () => {
    expect(await answer('/repos', {}, { timeline: '1' })).toEqual({ redirect: '/repos?timeline' });
    expect(
      await answer(
        '/repos',
        {},
        { repo: ['repo-prebidjs', 'repo-prebidserver'], age: ['30', '60'] },
      ),
    ).toEqual({ redirect: '/repos?repo=prebidjs,prebidserver&age=30,60' });
    expect(
      await answer(
        '/repos/[slug]',
        { slug: ['prebidjs'] },
        { scope: 'current', metric: 'openIssues', returnTo: '/repos?age=' },
      ),
    ).toEqual({ redirect: '/repos/prebidjs?view=issues&back=~age:' });
  });

  it('renders a canonical view and answers another spelling with its one form', async () => {
    expect(await answer('/repos', {}, { timeline: '', group: 'week' })).toEqual({
      status: 'canonical',
      screen: 'matrix',
      values: { timeline: true, group: 'week' },
      entry: false,
    });
    expect(await answer('/repos', {}, { timeline: '', group: 'month' })).toEqual({
      redirect: '/repos?timeline',
    });
    expect(await answer('/repos', {}, { repo: 'prebidserver,prebidjs' })).toEqual({
      redirect: '/repos?repo=prebidjs,prebidserver',
    });
    expect(await answer('/repos', {}, { v: '1' })).toMatchObject({
      status: 'canonical',
      entry: false,
    });
  });

  it('serves /reviewers with its own defaults and the `all` flag', async () => {
    expect(await answer('/reviewers', {}, { sort: '-reviewerContributions' })).toEqual({
      redirect: '/reviewers',
    });
    expect(await answer('/reviewers', {}, { all: '' })).toEqual({
      status: 'canonical',
      screen: 'contributionOverview',
      values: { all: true },
      entry: false,
    });
    expect(
      await answer('/reviewers', {}, {}, { saved: () => ({ presentation: { all: true } }) }),
    ).toEqual({
      redirect: '/reviewers?all',
    });
    expect(await answer('/reviewers', {}, { lens: 'reviewers' })).toMatchObject({
      status: 'invalid',
    });
    expect(
      await answer(
        '/companies',
        {},
        { all: '', lens: 'reviewers', sort: '-reviewerContributions' },
      ),
    ).toEqual({ redirect: '/companies?lens=reviewers&all' });
  });

  it('renders the invalid view for unknown parameters and rejected legacy links', async () => {
    expect(await answer('/repos', {}, { nope: '1' })).toMatchObject({ status: 'invalid' });
    expect(
      await answer('/repos/[slug]', { slug: ['prebidjs'] }, { view: 'commits', scope: 'x' }),
    ).toEqual({
      status: 'invalid',
      message: 'This link is invalid.',
    });
    expect(await answer('/repos', {}, { bsort: 'x'.repeat(7600) })).toEqual({
      status: 'invalid',
      message: oversizedLinkMessage,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects a bare entry to the saved view only when it differs from the defaults', async () => {
    const saved = vi.fn(() => ({ scope: { age: [] as string[] } }));
    expect(await answer('/repos', {}, {}, { saved })).toEqual({ redirect: '/repos?age=' });
    expect(saved).toHaveBeenCalledWith('summary', {});
    expect(await answer('/repos', {}, {}, { saved: () => ({ scope: { age: ['30'] } }) })).toEqual({
      status: 'canonical',
      screen: 'summary',
      values: {},
      entry: true,
    });
    expect(await answer('/repos', {}, {}, { saved: () => null })).toMatchObject({ entry: true });
    // An explicit URL never takes saved values.
    expect(await answer('/repos', {}, { v: '1' }, { saved })).toMatchObject({ values: { v: '1' } });
    // A legacy link whose canonical form is an entry is resolved in the same redirect.
    expect(
      await answer(
        '/repos',
        {},
        { timeline: '1' },
        { saved: () => ({ presentation: { group: 'week' } }) },
      ),
    ).toEqual({
      redirect: '/repos?timeline&group=week',
    });
    // Detail routes never take saved scope (decision C2).
    expect(
      await answer(
        '/contributors/[accountId]',
        { accountId: ['account-alice'] },
        {},
        {
          saved: () => ({ scope: { period: 'last-month' }, presentation: { sort: 'prsAuthored' } }),
        },
      ),
    ).toEqual({ redirect: '/contributors/account-alice?sort=prsAuthored' });
  });

  it('pins an old explicit-state link to the v1 defaults rather than an entry', async () => {
    seedPreferences(alice, { 'timeline.matrix': timelineSection('timeline.group=week', 'matrix') });
    const saved =
      (route: UrlRoute, segments: UrlSegments) => async (_: unknown, values: UrlValues) =>
        timelineEntryValues({ route, segments, values }, await readPreferences('repositories'));
    expect(
      await answer(
        '/repos',
        {},
        { timeline: '1', 'timeline.state': '1' },
        { saved: saved('/repos', {}) },
      ),
    ).toEqual({ redirect: '/repos?timeline&v=1' });
    expect(await answer('/repos', {}, { timeline: '1' }, { saved: saved('/repos', {}) })).toEqual({
      redirect: '/repos?timeline&group=week',
    });
  });
});

describe('timelineEntryValues', () => {
  const entry =
    (route: UrlRoute, segments: UrlSegments = {}) =>
    async () =>
      timelineEntryValues(
        { route, segments, values: { timeline: true } },
        await readPreferences(route.startsWith('/repos') ? 'repositories' : 'contributions'),
      );
  it('resolves the matrix entry to its saved scope and presentation', async () => {
    seedPreferences(alice, {
      'timeline.matrix': timelineSection(
        'timeline.group=week&period=last-month&repo=repo-prebidjs&timeline.sort=repository&timeline.dir=desc',
        'matrix',
      ),
    });
    expect(await entry('/repos')()).toEqual({
      scope: {},
      presentation: expect.objectContaining({
        repo: ['prebidjs'],
        period: 'last-month',
        group: 'week',
        sort: '-repository',
      }) as unknown,
    });
    expect(
      await answer('/repos', {}, { timeline: '' }, { saved: () => entry('/repos')() }),
    ).toEqual({
      redirect: '/repos?timeline&repo=prebidjs&period=last-month&group=week&sort=-repository',
    });
  });

  it('applies a repository Timeline section as presentation, period and filters included', async () => {
    seedPreferences(alice, {
      'timeline.repository': timelineSection(
        'timeline.group=quarter&period=last-full-year',
        'repository',
      ),
    });
    expect(await entry('/repos/[slug]', { slug: ['prebidjs'] })()).toEqual({
      scope: {},
      presentation: expect.objectContaining({
        group: 'quarter',
        period: 'last-full-year',
      }) as unknown,
    });
  });

  it('has nothing for absent sections, and leaves invalid ones to the entry’s notice', async () => {
    expect(await entry('/repos')()).toBeNull();
    seedPreferences(alice, { 'timeline.matrix': { version: 9 } });
    expect(await entry('/repos')()).toBeNull();
    seedPreferences(alice, {
      'timeline.matrix': timelineSection('timeline.group=decade', 'matrix'),
    });
    expect(await entry('/repos')()).toBeNull();
  });
});
