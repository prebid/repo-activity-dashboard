import { describe, expect, it } from 'vitest';
import {
  encodeQueryValue,
  isEntry,
  isLegacyKey,
  isRegistryName,
  parseQuery,
  queryPairs,
  sameQuery,
  serializeQuery,
  unknownParameterMessage,
  urlHref,
  withoutDefaults,
} from '@/lib/presentation/url/codec';
import {
  matchRoute,
  paramFor,
  routeArea,
  routePath,
  screenOf,
  screenParams,
  timelineScreen,
  urlRoutes,
  type UrlRoute,
} from '@/lib/presentation/url/registry';
import { contributionDirectorySample } from '@/mocks/contributions';
import { contributionSampleScenarios } from '@/models/contribution-page';

const canonical = (route: UrlRoute, query: string) => {
  const parsed = parseQuery(route, query);
  if (parsed.kind !== 'canonical') throw Error(JSON.stringify(parsed));
  return parsed;
};

describe('route table', () => {
  it('matches every report route and rejects other paths', () => {
    expect(matchRoute('/repos')).toEqual({ route: '/repos', segments: {} });
    expect(matchRoute('/repos/prebidjs')).toEqual({
      route: '/repos/[slug]',
      segments: { slug: ['prebidjs'] },
    });
    expect(matchRoute('/repos/prebidjs/authors/sample-bob')).toEqual({
      route: '/repos/[slug]/authors/[account]',
      segments: { slug: ['prebidjs'], account: ['sample-bob'] },
    });
    expect(matchRoute('/contributors/account%20one')).toEqual({
      route: '/contributors/[accountId]',
      segments: { accountId: ['account one'] },
    });
    expect(matchRoute('/companies/unmapped')?.segments).toEqual({ identity: ['unmapped'] });
    expect(matchRoute('/companies/id/company-acme')?.segments).toEqual({
      identity: ['id', 'company-acme'],
    });
    for (const route of ['/contributors', '/companies', '/reviewers', '/companies/export'])
      expect(matchRoute(route)?.route).toBe(route);
    for (const path of [
      '//evil.example/repos',
      'repos',
      '/foundation',
      '/admin/users',
      '/repos/a/b',
      '/repos/%E0%A4%A',
      '/repos/a%2Fb',
      '/repos//',
      '/companies/id',
      '/companies/other/x',
      '/reviewers/account-alice',
    ])
      expect(matchRoute(path)).toBeNull();
  });

  it('builds paths from decoded segments', () => {
    expect(routePath('/repos/[slug]/authors/[account]', { slug: ['a b'], account: ['c'] })).toBe(
      '/repos/a%20b/authors/c',
    );
    expect(routePath('/companies/[...identity]', { identity: ['id', 'x/y'] })).toBe(
      '/companies/id/x%2Fy',
    );
    expect(routePath('/repos/[slug]')).toBe('/repos');
    for (const route of urlRoutes) expect(routeArea(route)).toMatch(/repositories|contributions/);
  });

  it('decides the screen from selectors and the drilldown metric', () => {
    expect(screenOf('/repos', {})).toBe('summary');
    expect(screenOf('/repos', { timeline: true })).toBe('matrix');
    expect(screenOf('/repos', { timeline: true, detail: 'prsOpened' })).toBe('support');
    expect(screenOf('/repos/[slug]', {})).toBe('records');
    expect(screenOf('/repos/[slug]', { metric: 'prAuthors' })).toBe('insight');
    expect(screenOf('/repos/[slug]', { metric: 'prsOpened' })).toBe('records');
    expect(screenOf('/repos/[slug]', { timeline: true })).toBe('repositoryTimeline');
    expect(screenOf('/repos/[slug]/authors/[account]', {})).toBe('authorRecords');
    expect(screenOf('/contributors', {})).toBe('contributionOverview');
    expect(screenOf('/companies/[...identity]', {})).toBe('contributionDetail');
    expect(screenOf('/contributors/[accountId]', { timeline: true })).toBe('contributionTimeline');
    expect(screenOf('/companies/export', {})).toBe('export');
    expect(timelineScreen('/companies')).toBe('contributionTimeline');
  });

  it('gives a supporting view its Timeline parameters and its own', () => {
    expect(paramFor('/repos/[slug]', 'support', 'family')?.screens).toContain('repositoryTimeline');
    expect(paramFor('/repos', 'support', 'window')).toBeDefined();
    expect(paramFor('/repos', 'support', 'detail')?.domain).toBe('support');
    expect(paramFor('/contributors', 'support', 'family')).toBeUndefined();
    expect(paramFor('/companies', 'contributionOverview', 'lens')).toBeDefined();
    expect(paramFor('/contributors', 'contributionOverview', 'lens')).toBeUndefined();
    expect(paramFor('/repos', 'summary', 'nope')).toBeUndefined();
    const order = screenParams('/repos', 'matrix').map((entry) => entry.domain);
    expect(order).toEqual([...order].sort((a, b) => domainRank(a) - domainRank(b)));
    expect(screenParams('/repos', 'summary').map((entry) => entry.name)).toEqual([
      'repo',
      'period',
      'period2',
      'age',
      'bsort',
      'bpage',
      'asort',
      'apage',
      'v',
    ]);
  });
});
const domainRank = (domain: string) =>
  [
    'selector',
    'scope',
    'drilldown',
    'filter',
    'presentation',
    'support',
    'return',
    'version',
  ].indexOf(domain);

describe('parseQuery', () => {
  it('reads every encoding', () => {
    expect(
      canonical(
        '/repos',
        'repo=prebidjs,prebidserver&period=2026-01-01..2026-03-31&period2=last-month&age=30,60&bsort=-nonDraftPrs&bpage=2',
      ),
    ).toEqual({
      kind: 'canonical',
      screen: 'summary',
      values: {
        repo: ['prebidjs', 'prebidserver'],
        period: '2026-01-01..2026-03-31',
        period2: 'last-month',
        age: ['30', '60'],
        bsort: '-nonDraftPrs',
        bpage: '2',
      },
    });
    expect(
      canonical(
        '/repos/[slug]',
        'timeline&view=issues&family=snapshot&chart&omitted&group=week&at=2026-10-24T12:00Z&labels=a,b&labels=c&states=Open&cols=-author,labels&back=~repo:prebidjs',
      ).values,
    ).toEqual({
      timeline: true,
      view: 'issues',
      family: 'snapshot',
      chart: true,
      omitted: true,
      group: 'week',
      at: '2026-10-24T12:00Z',
      labels: ['a,b', 'c'],
      states: ['Open'],
      cols: ['-author', 'labels'],
      back: ['~repo:prebidjs'],
    });
    expect(
      canonical(
        '/repos',
        'timeline&detail=prsOpened&interval=month:2026-01-01&snap=rev-1@2026-10-24T12:00Z&origin=matrix&author=sample-bob&dq=x&dsort=-createdAt&dpage=2&dcols=&listq=a&listsort=-recordCount&listpage=3&window=2&metric=prsOpened,prsMerged',
      ).values,
    ).toMatchObject({
      dcols: [],
      interval: 'month:2026-01-01',
      metric: ['prsOpened', 'prsMerged'],
    });
    expect(
      canonical(
        '/companies/export',
        'entity=company&id=company-acme&layout=summary&columns=name,prsAuthored&lens=reviewers&zero=hide&view=repositories',
      ).screen,
    ).toBe('export');
    expect(canonical('/repos', 'v=1').values).toEqual({ v: '1' });
    expect(canonical('/contributors', 'type=&account=b,a').values).toEqual({
      type: [],
      account: ['b', 'a'],
    });
  });

  it('sends legacy keys and value forms to the legacy decoder', () => {
    for (const [route, query] of [
      ['/repos', 'timeline=1'],
      ['/repos', 'repo=repo-prebidjs'],
      ['/repos', 'repo=prebidjs&repo=prebidserver'],
      ['/repos', 'period=custom&from=2026-01-01&through=2026-01-31'],
      ['/repos', 'backlog.sort=name'],
      ['/repos/[slug]', 'scope=current&metric=openIssues'],
      ['/contributors', 'scope=1&period=this-year'],
      ['/contributors', 'nav=abc'],
      ['/repos/[slug]', 'returnTo=%2Frepos'],
    ] as const)
      expect(parseQuery(route, query)).toEqual({ kind: 'noncanonical' });
    // A slug that starts with "repo-" is a slug, not a legacy ID.
    expect(canonical('/repos', 'repo=repo-activity-dashboard').values.repo).toEqual([
      'repo-activity-dashboard',
    ]);
  });

  it('rejects unknown parameters and malformed values', () => {
    expect(parseQuery('/repos', 'nope=1')).toEqual({
      kind: 'invalid',
      message: unknownParameterMessage,
    });
    // A name another screen accepts is still unknown here.
    expect(parseQuery('/repos', 'group=week').kind).toBe('invalid');
    for (const [route, query] of [
      ['/repos', 'timeline=2'],
      ['/repos', 'timeline&timeline'],
      ['/repos', 'period=soon'],
      ['/repos', 'repo=a b'],
      ['/repos', 'bpage=0'],
      ['/repos', 'v=2'],
      ['/repos', 'bsort=a b'],
      ['/repos/[slug]', 'view=open'],
      ['/repos/[slug]', 'timeline&at=yesterday'],
      ['/repos/[slug]', 'cols=a b'],
      ['/repos/[slug]', 'states=Pending'],
      ['/repos/[slug]', 'q=' + 'x'.repeat(501)],
      ['/repos/[slug]', 'labels=' + 'x'.repeat(501)],
      ['/repos/[slug]', 'back=' + 'x'.repeat(7501)],
      ['/repos', 'timeline&detail=x&interval=month'],
      ['/repos', 'timeline&detail=x&interval=Month:2026-01-01'],
      ['/repos', 'timeline&detail=x&snap=rev'],
      ['/repos', 'timeline&detail=x&snap=rev@soon'],
      ['/contributors', 'sort=a&sort=b'],
    ] as const)
      expect(parseQuery(route, query).kind, query).toBe('invalid');
  });

  it('accepts every input shape', () => {
    expect(queryPairs({ a: '1', b: ['2', '3'], c: undefined })).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['b', '3'],
    ]);
    expect(queryPairs(new URLSearchParams('a=1'))).toEqual([['a', '1']]);
    expect(queryPairs([['a', '1']])).toEqual([['a', '1']]);
    expect(queryPairs('?a=%20')).toEqual([['a', ' ']]);
  });
});

describe('serializeQuery', () => {
  it('omits defaults and writes the compact encodings', () => {
    expect(serializeQuery('/repos', { period: 'this-month', age: ['30'] })).toBe('');
    expect(
      serializeQuery('/repos', {
        age: ['90', '30', '30'],
        repo: ['prebidserver', 'prebidjs', 'zzz'],
        bsort: '-totalOpenPrs',
        asort: 'name',
      }),
    ).toBe('repo=prebidjs,prebidserver,zzz&age=30,90&asort=name');
    expect(
      serializeQuery('/repos', { timeline: true, group: 'week', repo: ['prebidserver'] }),
    ).toBe('timeline&repo=prebidserver&group=week');
    expect(
      serializeQuery('/repos', {
        timeline: true,
        detail: 'prsOpened',
        interval: 'month:2026-01-01',
        snap: 'rev@2026-10-24T12:00Z',
      }),
    ).toBe('timeline&detail=prsOpened&interval=month:2026-01-01&snap=rev@2026-10-24T12:00Z');
    expect(
      serializeQuery('/repos/[slug]', {
        q: 'a b/c&d',
        labels: ['x,y', 'z'],
        cols: [],
        back: ['~repo:prebidjs'],
      }),
    ).toBe('labels=x,y&labels=z&q=a%20b/c%26d&back=~repo:prebidjs');
    expect(
      serializeQuery('/contributors', {
        type: ['bot', 'human'],
        account: ['b', 'a', 'b'],
        sort: '-authoredPrsMerged',
      }),
    ).toBe('type=human,bot&account=a,b');
    expect(serializeQuery('/reviewers', { sort: '-reviewerContributions' })).toBe('');
  });

  it('pins the defaults with v=1 only when nothing but selectors remains', () => {
    expect(serializeQuery('/repos', {}, { explicit: true })).toBe('v=1');
    expect(serializeQuery('/repos', { v: '1' })).toBe('v=1');
    expect(serializeQuery('/repos', { v: '1', age: [] })).toBe('age=');
    expect(serializeQuery('/repos', { timeline: true }, { explicit: true })).toBe('timeline&v=1');
    expect(serializeQuery('/companies/export', { v: '1' }, { explicit: true })).toBe('');
  });

  it('round-trips through parseQuery', () => {
    for (const [route, query] of [
      ['/repos', 'repo=prebidjs,prebidserver&period2=last-month&age=30,60,90'],
      ['/repos', 'timeline&repo=prebidserver&group=week'],
      ['/repos/[slug]', 'metric=prAuthors&period=this-month&at=2026-10-24T12:00Z'],
      ['/companies', 'lens=reviewers'],
    ] as const) {
      const href = urlHref(route, { slug: ['prebidjs'] }, canonical(route, query).values);
      const [, search = ''] = href.split('?');
      expect(serializeQuery(route, canonical(route, search).values)).toBe(search);
    }
  });

  it('builds hrefs, compares queries and finds entries', () => {
    expect(
      urlHref('/repos/[slug]', { slug: ['prebidjs'] }, { view: 'issues' }, { hash: 'x' }),
    ).toBe('/repos/prebidjs?view=issues#x');
    expect(urlHref('/repos', {}, {})).toBe('/repos');
    expect(
      sameQuery('timeline&a=1', [
        ['a', '1'],
        ['timeline', ''],
      ]),
    ).toBe(true);
    expect(sameQuery('a=1', 'a=2')).toBe(false);
    expect(isEntry('/repos', {})).toBe(true);
    expect(isEntry('/repos', { timeline: true, sample: 'mixed' })).toBe(true);
    expect(isEntry('/repos/[slug]', { view: 'issues', back: ['-'] })).toBe(true);
    expect(isEntry('/repos', { v: '1' })).toBe(false);
    expect(isEntry('/repos', { age: [] })).toBe(false);
    expect(isEntry('/repos/[slug]/authors/[account]', {})).toBe(false);
    expect(isEntry('/contributors/export', {})).toBe(false);
    expect(withoutDefaults('/repos', { v: '1', period: 'this-month', unknown: 'x' })).toEqual({
      v: '1',
      unknown: 'x',
    });
  });

  it('keeps query delimiters escaped and readable characters literal', () => {
    expect(encodeQueryValue('a,b:c@d/e f&g=h#i%')).toBe('a,b:c@d/e%20f%26g%3Dh%23i%25');
    expect(isLegacyKey('timeline.group')).toBe(true);
    expect(isLegacyKey('group')).toBe(false);
    expect(isRegistryName('group')).toBe(true);
    expect(isRegistryName('timeline.group')).toBe(false);
  });
});

it('accepts every sample account and company ID as a literal list item', () => {
  for (const scenario of contributionSampleScenarios) {
    const directory = contributionDirectorySample(scenario);
    for (const id of [
      ...directory.accounts.map((row) => row.id),
      ...directory.companies.map((row) => row.id),
    ])
      expect(id).toMatch(/^[A-Za-z0-9._~:@-]+$/);
    expect(directory.companies.map((row) => row.id)).not.toContain('unmapped');
  }
});
