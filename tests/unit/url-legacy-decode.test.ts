import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { urlHref } from '@/lib/presentation/url/codec';
import { legacyDecode } from '@/lib/presentation/url/legacy/decode';
import { legacyState } from '@/lib/presentation/url/legacy/state';
import {
  instantIso,
  instantValue,
  periodAt,
  periodRange,
  periodSelection,
  periodValue,
  rangeValues,
} from '@/lib/presentation/url/period';
import { matchRoute } from '@/lib/presentation/url/registry';
import { withContributionReturn } from '@/lib/presentation/contribution-return';
import { legacyContext } from '@/server/legacy-context';

const context = legacyContext();
const asOf = context.asOf; // 2026-10-24T12:00:00.000Z

/** The canonical href a legacy href redirects to, or the invalid message. */
function canonical(href: string): string {
  const url = new URL(href, 'https://dashboard.invalid');
  const { route, segments } = matchRoute(url.pathname)!;
  const decoded = legacyDecode(route, segments, url.search, context);
  return decoded.kind === 'values' ? urlHref(route, segments, decoded.values) : 'invalid';
}

describe('period encodings', () => {
  it('writes and reads periods', () => {
    expect(periodValue({ kind: 'preset', preset: 'last-month' })).toBe('last-month');
    expect(periodValue({ kind: 'custom', from: '2026-01-01', through: '2026-02-28' })).toBe(
      '2026-01-01..2026-02-28',
    );
    expect(periodSelection('2026-01-01..2026-02-28')).toEqual({
      kind: 'custom',
      from: '2026-01-01',
      through: '2026-02-28',
    });
    expect(periodSelection('this-year')).toEqual({ kind: 'preset', preset: 'this-year' });
    expect(periodSelection('2026-03-01..2026-02-28')).toBeNull();
    expect(periodSelection('soon')).toBeNull();
  });

  it('writes the shortest instant and reads every spelling back', () => {
    for (const [iso, short] of [
      ['2026-10-01T00:00:00.000Z', '2026-10-01'],
      ['2026-10-24T12:00:00.000Z', '2026-10-24T12:00Z'],
      ['2026-10-24T12:00:05.000Z', '2026-10-24T12:00:05Z'],
      ['2026-10-24T12:00:05.250Z', '2026-10-24T12:00:05.250Z'],
    ]) {
      expect(instantValue(iso)).toBe(short);
      expect(instantIso(short)).toBe(iso);
    }
    expect(instantIso('2026-02-30')).toBeNull();
    expect(instantIso('later')).toBeNull();
  });

  it('pins an exact interval as a period plus snapshot', () => {
    const thisMonth = periodRange({ kind: 'preset', preset: 'this-month' }, asOf)!;
    expect(rangeValues(thisMonth)).toEqual({ period: 'this-month', at: '2026-10-24T12:00Z' });
    const september = {
      start: '2026-09-01T00:00:00.000Z',
      end: '2026-10-01T00:00:00.000Z',
      endInclusive: false,
    };
    expect(rangeValues(september)).toEqual({ period: 'last-month', at: '2026-10-01' });
    const days = {
      start: '2026-03-02T00:00:00.000Z',
      end: '2026-03-05T00:00:00.000Z',
      endInclusive: false,
    };
    expect(rangeValues(days)).toEqual({ period: '2026-03-02..2026-03-04', at: '2026-03-05' });
    const partial = {
      start: '2026-03-02T06:00:00.000Z',
      end: '2026-03-05T00:00:00.000Z',
      endInclusive: false,
    };
    expect(rangeValues(partial)).toBeNull();
    expect(periodAt(days, '2026-03-01T00:00:00.000Z')).toBeNull();
    expect(periodRange({ kind: 'preset', preset: 'this-year' }, 'not-an-instant')).toBeNull();
  });
});

describe('legacyDecode', () => {
  it('drops defaults and keeps explicit choices on the Summary', () => {
    expect(
      canonical(
        '/repos?period=custom&from=2026-01-01&through=2026-01-31&backlog.page=2&activity.sort=name',
      ),
    ).toBe('/repos?period=2026-01-01..2026-01-31&bpage=2&asort=name');
    expect(canonical('/repos?repo=repo-prebidserver&repo=repo-prebidjs&age=')).toBe(
      '/repos?repo=prebidjs,prebidserver&age=',
    );
  });

  it('decodes the matrix, keeping a window other than the last', () => {
    expect(
      canonical(
        '/repos?timeline=1&timeline.state=1&timeline.group=week&timeline.window=2&timeline.metric=prsMerged&timeline.metric=prsOpened&timeline.rank=prsOpened&timeline.sort=repository&timeline.dir=desc&timeline.gap=1&sample=mixed',
      ),
    ).toBe(
      '/repos?timeline&sample=mixed&gap&metric=prsMerged,prsOpened&rank=prsOpened&group=week&window=2&sort=-repository',
    );
    expect(canonical('/repos?timeline=1&summary=%2Ffoundation')).toBe('invalid');
    expect(canonical('/repos?timeline=1&timeline.group=decade')).toBe('invalid');
    expect(canonical('/repos?timeline=1&sample=nope')).toBe('invalid');
  });

  it('decodes repository Timelines with filters, columns and charts', () => {
    expect(
      canonical(
        '/repos/prebidjs?timeline=1&timeline.kind=prs&timeline.family=snapshot&timeline.metric=nonDraftPrs&timeline.chart=1&timeline.columns=totalOpenPrs&timeline.columns=agedPrs30&prs.filter.draft=drafts&prs.filter.labels=a%2Cb&prs.filter.reviewers=0&prs.filter.ageBand=30&prs.q=fix',
      ),
    ).toBe(
      '/repos/prebidjs?timeline&metric=nonDraftPrs&labels=a,b&draft=drafts&ageBand=30&reviewers=0&family=snapshot&chart&q=fix&cols=-draftPrs,-nonDraftPrs,-humanApprovals0,-humanApprovals1,-humanApprovals2,agedPrs30',
    );
    expect(canonical('/repos/prebidjs?timeline=1&prs.filter.draft=maybe')).toBe('invalid');
    expect(
      canonical(
        '/repos/prebidjs?timeline=1&period=this-year&timeline.from=2026-02-01T00:00:00.000Z&timeline.to=2026-03-01T00:00:00.000Z&timeline.inclusive=0',
      ),
    ).toBe('invalid');
  });

  it('decodes record lists and insights', () => {
    expect(
      canonical(
        '/repos/prebidjs?scope=period&metric=issuesOpened&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1&issues.filter.assignment=unassigned&issues.filter.eventFrom=2026-10-01T00:00:00.000Z&issues.filter.eventTo=2026-10-24T12:00:00.000Z&issues.filter.eventInclusive=1&issues.sort=number&issues.page=3&issues.columns=number&issues.columns=title&issues.charts=1',
      ),
    ).toBe(
      '/repos/prebidjs?period=this-year&at=2026-10-24T12:00Z&metric=issuesOpened&assignment=unassigned&events=this-month&sort=number&page=3&cols=-author,-createdAt&charts',
    );
    expect(
      canonical(
        '/repos/prebidjs?scope=period&metric=issuesOpened&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1&issues.filter.eventFrom=2026-10-01T06:00:00.000Z&issues.filter.eventTo=2026-10-24T12:00:00.000Z&issues.filter.eventInclusive=1',
      ),
    ).toBe('invalid');
    expect(
      canonical(
        '/repos/prebidjs?scope=period&metric=agentFeedbackCredits&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1&credits.q=bot&credits.sort=account&credits.page=2',
      ),
    ).toBe(
      '/repos/prebidjs?period=this-month&at=2026-10-24T12:00Z&metric=agentFeedbackCredits&q=bot&sort=account&page=2',
    );
    expect(
      canonical(
        '/repos/prebidjs?scope=period&metric=prsOpened&from=2026-10-01T06:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
      ),
    ).toBe('invalid');
    expect(canonical('/repos/prebidjs?view=commits')).toBe('invalid');
    expect(canonical('/repos/prebidjs?prs.filter.nope=1')).toBe('invalid');
    expect(canonical('/repos/unknown-repository?view=issues')).toBe('invalid');
  });

  it('decodes author record pages', () => {
    expect(
      canonical(
        '/repos/prebidjs/authors/sample-bob?scope=period&metric=prAuthors&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1&authors.q=bob&authors.page=2&prs.sort=number',
      ),
    ).toBe(
      '/repos/prebidjs/authors/sample-bob?period=this-month&at=2026-10-24T12:00Z&metric=prAuthors&sort=number&listq=bob&listpage=2',
    );
    expect(canonical('/repos/prebidjs/authors/sample-bob?scope=current&metric=totalOpenPrs')).toBe(
      'invalid',
    );
    expect(
      canonical(
        '/repos/prebidjs/authors/sample-bob?scope=period&metric=prAuthors&from=2026-10-01T06:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
      ),
    ).toBe('invalid');
  });

  it('decodes contribution scope, population and table choices', () => {
    expect(
      canonical(
        '/companies/id/company-acme?scope=1&period=last-month&population=selected&account=account-bob&company=&exclude=account-carol&type=human&view=repositories&repositories.q=x&repositories.page=2&repo=repo-prebidjs',
      ),
    ).toBe(
      '/companies/id/company-acme?view=repositories&repo=prebidjs&period=last-month&type=human&account=account-bob&company=unmapped&exclude=account-carol&q=x&page=2',
    );
    expect(
      canonical(
        '/companies/id/company-acme?scope=1&population=selected&company=company-acme&members.zero=hide',
      ),
    ).toBe('/companies/id/company-acme?company=company-acme&zero=hide');
    expect(canonical('/contributors?scope=1&population=selected')).toBe('/contributors?account=');
    expect(canonical('/contributors?scope=1&sample=large')).toBe('/contributors?sample=large');
    expect(canonical('/contributors?sample=unknown')).toBe('invalid');
    expect(legacyDecode('/companies/[...identity]', { identity: ['other'] }, '', context)).toEqual({
      kind: 'invalid',
      message: 'This link is invalid.',
    });
    expect(canonical('/contributors?timeline=1&sample=mixed')).toBe('invalid');
    expect(
      canonical(
        '/contributors?timeline=1&timeline.gap=1&timeline.columns=prsAuthored&timeline.group=week',
      ),
    ).toBe('/contributors?timeline&gap&group=week&cols=-authoredPrsMerged,-issuesAuthored');
    expect(canonical('/contributors?timeline=1&timeline.group=decade')).toBe('invalid');
  });

  it('decodes supporting views with their own table state', () => {
    expect(
      canonical(
        '/repos/prebidjs?timeline=1&timeline.detail=prAuthors&timeline.interval=month%3A2026-01-01T00%3A00%3A00.000Z&timeline.revision=r1&timeline.clock=2026-10-24T12%3A00%3A00.000Z&support.author=sample-bob&support.authors.sort=recordCount&support.authors.dir=desc&support.records.q=fix&support.records.page=2',
      ),
    ).toBe(
      '/repos/prebidjs?timeline&listsort=-recordCount&detail=prAuthors&interval=month:2026-01-01&snap=r1@2026-10-24T12:00Z&author=sample-bob&dq=fix&dpage=2',
    );
    expect(canonical('/repos/prebidjs?timeline=1&timeline.detail=prAuthors')).toBe('invalid');
    expect(
      canonical(
        '/repos?timeline=1&timeline.group=decade&timeline.detail=x&timeline.interval=month%3A2026-01-01T00%3A00%3A00.000Z&timeline.revision=r1&timeline.clock=2026-10-24T12%3A00%3A00.000Z',
      ),
    ).toBe('invalid');
  });

  it('translates legacy return context into back frames', () => {
    // A malformed trail renders the page with an unavailable crumb (P5d behaviour change).
    expect(canonical('/contributors/account-alice?scope=1&nav=@@@')).toBe(
      '/contributors/account-alice?back=!',
    );
    // A top-level report has no parent, so its trail is dropped.
    expect(canonical('/contributors?scope=1&nav=@@@')).toBe('/contributors');
    // An Over time's parent must be its own Report.
    const elsewhere = withContributionReturn('/contributors?timeline=1', '/companies')!;
    expect(canonical(elsewhere)).toBe('/contributors?timeline&back=!');
    const own = withContributionReturn(
      '/contributors?timeline=1',
      '/contributors?report.q=Sample%20contributor',
    )!;
    expect(canonical(own)).toBe('/contributors?timeline&back=~q:Sample*20contributor');
    // A supporting view carries its Timeline's trail.
    const support = withContributionReturn(
      '/contributors?timeline=1&timeline.detail=prsAuthored&timeline.interval=month%3A2026-01-01T00%3A00%3A00.000Z&timeline.revision=r1&timeline.clock=2026-10-24T12%3A00%3A00.000Z',
      '/contributors?report.page=2',
    )!;
    expect(canonical(support)).toMatch(/&back=~page:2$/);
    // A matrix parent whose own Summary snapshot is unusable keeps the matrix and loses the rest.
    const matrix = encodeURIComponent('/repos?timeline=1&summary=%2Ffoundation');
    expect(canonical('/repos/prebidjs?timeline=1&timelineParent=' + matrix)).toBe(
      '/repos/prebidjs?timeline&back=/repos~timeline&back=!',
    );
    expect(canonical('/repos/prebidjs?timeline=1&timelineParent=%2Ffoundation')).toBe('invalid');
    expect(canonical('/repos/prebidjs?returnTo=%2Frepos%3Fage%3D')).toBe(
      '/repos/prebidjs?back=~age:',
    );
  });

  it('reads no state for routes outside the report pages', () => {
    expect(legacyState('/foundation', '/foundation', context)).toEqual({
      route: '/foundation',
      state: 'no reader',
    });
    expect(
      legacyState('/contributors/[accountId]', '/contributors/%E0%A4%A', context).state,
    ).toEqual({
      focus: null,
    });
  });
});
