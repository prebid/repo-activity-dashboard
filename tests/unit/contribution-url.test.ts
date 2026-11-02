import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { contributionSample } from '@/mocks/contributions';
import {
  childViewHref,
  contributionColumnVisibility,
  contributionScopeInput,
  contributionScopeValues,
  contributionViewOf,
  savedPresentationValues,
} from '@/lib/presentation/contribution-url';
import {
  defaultContributionSettings,
  validateContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionTimelineHref } from '@/lib/presentation/contribution-timeline';
import { contributionReturnHref } from '@/lib/presentation/contribution-return';
import { parseQuery, urlHref, withoutDefaults } from '@/lib/presentation/url/codec';
import { legacyDecode } from '@/lib/presentation/url/legacy/decode';
import { resolveBack } from '@/lib/presentation/url/back';
import type { ContributionSettings } from '@/models/contribution-settings';
import { legacyContext } from '@/server/legacy-context';

const source = contributionSample();
const defaults = defaultContributionSettings(source);
const view = (href: string) => {
  const result = contributionViewOf(href);
  if (!result) throw Error('Expected a canonical contribution view: ' + href);
  return result;
};

it.each<[string, (value: ContributionSettings) => void, string]>([
  ['the defaults', () => {}, ''],
  [
    'a custom period and narrowed repositories and types',
    (value) => {
      value.period = { kind: 'custom', from: '2026-09-01', through: '2026-09-30' };
      value.selection.repositoryIds = ['repo-prebidserver', 'repo-prebidjs'];
      value.selection.actorTypes = ['bot', 'human'];
    },
    'repo=prebidjs,prebidserver&period=2026-09-01..2026-09-30&type=human,bot',
  ],
  [
    'a selected population with Unmapped and exclusions',
    (value) => {
      value.selection.population = {
        kind: 'selected',
        accountIds: ['account-bob'],
        companyIds: [null, 'company-acme'],
      };
      value.selection.excludedAccountIds = ['account-alice'];
    },
    'account=account-bob&company=company-acme,unmapped&exclude=account-alice',
  ],
  [
    'explicitly empty selections',
    (value) => {
      value.selection.repositoryIds = [];
      value.selection.actorTypes = [];
      value.selection.population = { kind: 'selected', accountIds: [], companyIds: [] };
    },
    'repo=&type=&account=',
  ],
])('writes %s as scope values and reads them back', (_, change, query) => {
  const settings = structuredClone(defaults);
  change(settings);
  const values = contributionScopeValues(settings);
  expect(urlHref('/contributors', {}, values).replace(/^\/contributors\??/, '')).toBe(query);
  const parsed = parseQuery('/contributors', query);
  if (parsed.kind !== 'canonical') throw Error('Expected canonical');
  const read = validateContributionSettings(
    contributionScopeInput(parsed.values, source),
    source,
    source.asOf,
  );
  expect(read && urlHref('/contributors', {}, contributionScopeValues(read))).toBe(
    urlHref('/contributors', {}, values),
  );
});

it('shows the contributor lens’s three metric columns by default (decision C5)', () => {
  const visible = (href: string) => {
    const { route, values } = view(href);
    const columns = contributionColumnVisibility(route, values)!;
    return Object.keys(columns).filter((id) => columns[id]);
  };
  expect(visible('/contributors')).toEqual([
    'name',
    'actorType',
    'company',
    'prsAuthored',
    'authoredPrsMerged',
    'issuesAuthored',
  ]);
  expect(
    visible('/companies/unmapped?view=repositories&cols=mergesPerformed,-issuesAuthored'),
  ).toEqual(['name', 'prsAuthored', 'authoredPrsMerged', 'mergesPerformed']);
  // A column the table lacks makes the view invalid rather than ignored.
  expect(contributionColumnVisibility('/contributors', { cols: ['members'] })).toBeNull();
});

it('writes a table’s saved presentation as explicit fields on the links that open it (C3)', () => {
  const saved = {
    contributors: {
      columns: { prComments: true, issuesAuthored: false, name: false },
      sort: { sort: 'prComments', descending: true },
    },
    members: { hideZeroMembers: true, sort: { sort: 'company', descending: false } },
    details: { columns: { lastAt: true } },
  };
  expect(savedPresentationValues('/contributors', {}, saved)).toEqual({
    // The name column always shows.
    cols: ['-issuesAuthored', 'prComments'],
    sort: '-prComments',
  });
  // A saved sort on a column the table lacks does not apply; zero totals are a members choice.
  expect(savedPresentationValues('/companies/[...identity]', {}, saved)).toEqual({ zero: 'hide' });
  expect(savedPresentationValues('/companies', {}, saved)).toEqual({});
  // Comment details show Last activity by default; credit details do not.
  expect(savedPresentationValues('/contributors', { metric: 'prComments' }, saved)).toEqual({});
  expect(savedPresentationValues('/contributors', { metric: 'prsAuthored' }, saved)).toEqual({
    cols: ['lastAt'],
  });
});

it('carries the parent as the first back frame and its own frames after it', () => {
  const company = view(
    '/companies/id/company-acme?period=last-month&back=/contributors/account-alice',
  );
  const child = childViewHref(company, {
    route: '/contributors/[accountId]',
    segments: { accountId: ['account-bob'] },
    values: { period: 'last-month' },
  });
  expect(child).toBe(
    '/contributors/account-bob?period=last-month&back=/companies/id/company-acme&back=/contributors/account-alice',
  );
  const ancestors = resolveBack(view(child!));
  expect(ancestors.map((ancestor) => ancestor.available && ancestor.href)).toEqual([
    '/companies/id/company-acme?period=last-month&back=/contributors/account-alice',
    '/contributors/account-alice?period=last-month',
    '/contributors?period=last-month',
  ]);
  // A derived parent costs nothing.
  const overview = view('/contributors?period=last-month');
  expect(
    childViewHref(overview, {
      route: '/contributors/[accountId]',
      segments: { accountId: ['account-bob'] },
      values: { period: 'last-month' },
    }),
  ).toBe('/contributors/account-bob?period=last-month');
  // An immediate parent that cannot fit disables the link.
  const crowded = view('/contributors?q=' + 'x'.repeat(500) + '&exclude=' + 'a'.repeat(7000));
  expect(
    childViewHref(crowded, {
      route: '/contributors/[accountId]',
      segments: { accountId: ['account-bob'] },
      values: { exclude: ['a'.repeat(7000)] },
    }),
  ).toBeNull();
});

it('links a report to its legacy Over time with a trail that decodes back to the report', () => {
  const report = view(
    '/contributors/account-alice?sample=large&q=agent&sort=name&cols=prComments&back=~q:heavy',
  );
  const settings = validateContributionSettings(
    contributionScopeInput(report.values, contributionSample({ scenario: 'large' })),
    contributionSample({ scenario: 'large' }),
    source.asOf,
  )!;
  const timeline = new URL(contributionTimelineHref(report, settings)!, 'https://dashboard.test');
  expect(timeline.pathname).toBe('/contributors/account-alice');
  expect(timeline.searchParams.get('timeline')).toBe('1');
  // The Over time's Report tab restores the report in legacy form; the page answers it with a
  // 307 to the canonical report, with the report's own parent as its frame.
  const restored = contributionReturnHref(timeline.searchParams, '/');
  const url = new URL(restored, 'https://dashboard.test');
  const decoded = legacyDecode(report.route, report.segments, url.searchParams, legacyContext());
  if (decoded.kind !== 'values') throw Error('Expected the frozen readers to decode the report');
  expect(withoutDefaults(report.route, decoded.values)).toEqual(report.values);
});

it('carries report ancestors in the legacy Over time trail and stops at any other ancestor', () => {
  const settings = defaultContributionSettings(source);
  const trail = (href: string) => {
    const timeline = new URL(contributionTimelineHref(view(href), settings)!, 'https://x.test');
    const chain: string[] = [];
    let params = timeline.searchParams;
    for (let step = 0; step < 4; step++) {
      const parent = contributionReturnHref(params, '');
      if (!parent) break;
      const url = new URL(parent, 'https://x.test');
      chain.push(url.pathname);
      params = url.searchParams;
    }
    return chain;
  };
  // An overview is top-level: its Over time returns to it alone.
  expect(trail('/companies?q=Acme')).toEqual(['/companies']);
  // A company's members table, hiding zero totals, then the derived Companies report.
  expect(trail('/companies/id/company-acme?zero=hide&page=2')).toEqual([
    '/companies/id/company-acme',
    '/companies',
  ]);
  expect(
    contributionReturnHref(
      new URL(
        contributionTimelineHref(view('/companies/id/company-acme?zero=hide&page=2'), settings)!,
        'https://x.test',
      ).searchParams,
      '',
    ),
  ).toContain('members.page=2&members.zero=hide');
  // An unavailable ancestor, or an Over time one, ends the trail there.
  expect(trail('/contributors/account-alice?back=!')).toEqual(['/contributors/account-alice']);
  expect(trail('/companies/id/company-acme?back=/contributors/account-alice~timeline')).toEqual([
    '/companies/id/company-acme',
  ]);
  // Only a report has an Over time link.
  expect(contributionTimelineHref(view('/contributors?timeline'), settings)).toBeNull();
});
