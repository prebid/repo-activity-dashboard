import { describe, expect, it } from 'vitest';
import {
  allowedParent,
  decodeFrame,
  derive,
  encodeFrame,
  escapeFrameText,
  fitBack,
  rebaseBack,
  resolveBack,
  sameView,
  unescapeFrameText,
  viewPairs,
  withBack,
  type UrlView,
} from '@/lib/presentation/url/back';

const summary = (values = {}): UrlView => ({ route: '/repos', segments: {}, values });
const repoPage = (values = {}): UrlView => ({
  route: '/repos/[slug]',
  segments: { slug: ['prebidjs'] },
  values,
});
const contributor = (values = {}): UrlView => ({
  route: '/contributors/[accountId]',
  segments: { accountId: ['account-alice'] },
  values,
});
const company = (values = {}): UrlView => ({
  route: '/companies/[...identity]',
  segments: { identity: ['id', 'company-acme'] },
  values,
});

describe('frame text', () => {
  it('escapes every byte outside the plain set and reads it back', () => {
    for (const text of ['Sample contributor', '100%', 'a~b*c/d+e', 'café', '中文', '🙂', 'a,b:c@d'])
      expect(unescapeFrameText(escapeFrameText(text)!)).toBe(text);
    expect(escapeFrameText('a b%~*/+')).toBe('a*20b*25*7E*2A*2F*2B');
    expect(escapeFrameText('é')).toBe('*C3*A9');
    expect(escapeFrameText('\uD800')).toBeNull();
    for (const text of ['*G1', '*4', 'a b', '%20', '*FF', '*C3'])
      expect(unescapeFrameText(text)).toBeNull();
  });
});

describe('derive', () => {
  it('names each page’s parent', () => {
    expect(derive(summary())).toEqual({ kind: 'top' });
    expect(derive({ route: '/companies/export', segments: {}, values: {} })).toEqual({
      kind: 'top',
    });
    expect(derive(summary({ timeline: true, repo: ['prebidjs'], group: 'week' }))).toEqual({
      kind: 'derived',
      parent: summary({ repo: ['prebidjs'] }),
    });
    expect(derive(repoPage({ metric: 'prAuthors' }))).toEqual({
      kind: 'derived',
      parent: summary(),
    });
    expect(derive(repoPage({ timeline: true }))).toEqual({ kind: 'none' });
    expect(
      derive({
        route: '/repos/[slug]/authors/[account]',
        segments: { slug: ['prebidjs'], account: ['bob'] },
        values: {
          metric: 'prAuthors',
          period: 'this-year',
          listsort: '-recordCount',
          sort: 'number',
          back: ['~age:'],
        },
      }),
    ).toEqual({
      kind: 'inherit',
      parent: repoPage({
        metric: 'prAuthors',
        period: 'this-year',
        back: ['~age:'],
        sort: '-recordCount',
      }),
    });
    const support = {
      timeline: true,
      group: 'week',
      detail: 'prAuthors',
      interval: 'week:2026-01-05',
      snap: 'r@2026-01-01',
      author: 'bob',
      dq: 'x',
      listq: 'b',
    };
    expect(derive(repoPage(support))).toEqual({
      kind: 'inherit',
      parent: repoPage({
        timeline: true,
        group: 'week',
        detail: 'prAuthors',
        interval: 'week:2026-01-05',
        snap: 'r@2026-01-01',
        listq: 'b',
      }),
    });
    expect(derive(repoPage({ ...support, author: undefined }))).toMatchObject({
      parent: { values: { timeline: true, group: 'week' } },
    });
    expect(derive({ route: '/contributors', segments: {}, values: {} })).toEqual({ kind: 'top' });
    expect(
      derive({
        route: '/contributors',
        segments: {},
        values: { metric: 'prsAuthored', period: 'last-month', q: 'x' },
      }),
    ).toEqual({
      kind: 'derived',
      parent: { route: '/contributors', segments: {}, values: { period: 'last-month' } },
    });
    expect(derive(contributor({ timeline: true, period: 'last-month', group: 'week' }))).toEqual({
      kind: 'derived',
      parent: contributor({ period: 'last-month' }),
    });
    expect(derive(contributor({ lens: 'reviewers', repo: ['prebidjs'], sort: 'x' }))).toEqual({
      kind: 'derived',
      parent: { route: '/reviewers', segments: {}, values: { repo: ['prebidjs'] } },
    });
    expect(derive(contributor({ sample: 'large' }))).toMatchObject({
      parent: { route: '/contributors', values: { sample: 'large' } },
    });
    expect(derive(company({ lens: 'reviewers', view: 'repositories' }))).toEqual({
      kind: 'derived',
      parent: { route: '/companies', segments: {}, values: { lens: 'reviewers' } },
    });
  });
});

describe('frames', () => {
  it('writes - for a derived parent, ~ for its differences and a path for another route', () => {
    expect(encodeFrame(repoPage(), summary())).toBe('-');
    expect(
      encodeFrame(
        repoPage({ metric: 'prsOpened' }),
        summary({
          repo: ['prebidjs', 'prebidserver'],
          period2: 'last-month',
          age: ['30', '60', '90'],
        }),
      ),
    ).toBe('~repo:prebidjs,prebidserver~period2:last-month~age:30,60,90');
    expect(encodeFrame(summary({ timeline: true, repo: ['prebidjs'] }), summary())).toBe('~-repo');
    expect(encodeFrame(contributor(), company())).toBe('/companies/id/company-acme');
    expect(
      encodeFrame(
        contributor({ period: 'last-month' }),
        company({ period: 'last-month', q: 'Sample contributor' }),
      ),
    ).toBe('/companies/id/company-acme~q:Sample*20contributor');
    // The baseline of another route keeps the derived scope it shares, so a narrower parent says so.
    expect(
      encodeFrame(
        {
          route: '/contributors',
          segments: {},
          values: { metric: 'prsAuthored', repo: ['prebidjs'] },
        },
        contributor(),
      ),
    ).toBe('/contributors/account-alice~-repo');
    expect(
      encodeFrame(contributor({ metric: 'prsAuthored', repo: ['prebidjs'] }), contributor()),
    ).toBe('/contributors/account-alice~-repo');
    expect(
      encodeFrame(repoPage({ timeline: true }), summary({ timeline: true, repo: ['prebidjs'] })),
    ).toBe('/repos~timeline~repo:prebidjs');
    // The codec writes a lone surrogate as U+FFFD, as URLSearchParams does.
    expect(encodeFrame(contributor(), company({ q: '\uD800' }))).toBe(
      '/companies/id/company-acme~q:*EF*BF*BD',
    );
    expect(
      encodeFrame(contributor(), {
        route: '/companies/[...identity]',
        segments: { identity: ['id', '\uD800'] },
        values: {},
      }),
    ).toBeNull();
  });

  it('reads frames back into the same parent', () => {
    const cases: [UrlView, UrlView][] = [
      [repoPage({ metric: 'prsOpened' }), summary({ repo: ['prebidjs'], period2: 'last-month' })],
      [contributor({ period: 'last-month' }), company({ period: 'last-month', q: 'Ünïcode ~*/%' })],
      [repoPage({ timeline: true }), summary({ timeline: true, repo: ['prebidjs'] })],
      [repoPage({ timeline: true }), repoPage({ view: 'issues', labels: ['a,b', 'c'] })],
      [contributor({ metric: 'prsAuthored', repo: ['prebidjs'] }), contributor()],
    ];
    for (const [child, parent] of cases) {
      const frame = encodeFrame(child, parent)!;
      expect(decodeFrame(child, frame), frame).toMatchObject(parent);
      expect(viewPairs(decodeFrame(child, frame)!)).toEqual(viewPairs(parent));
    }
  });

  it('rejects frames that cannot stand at their position', () => {
    for (const frame of [
      '~',
      '/repos~',
      'repo:x',
      '~repo:a b',
      '~-repo:x',
      '~9x',
      '~nope:1',
      '~timeline.group:week',
      '//evil.example/repos',
      '/foundation',
      '/repos/a*ZZ',
      '/repos/prebidjs~timeline',
      '/contributors',
    ])
      expect(decodeFrame(repoPage({ metric: 'prsOpened' }), frame), frame).toBeNull();
    // A Timeline has no derived parent, so a relative frame cannot apply.
    expect(decodeFrame(repoPage({ timeline: true }), '~repo:prebidjs')).toBeNull();
    // A repository Timeline's list parent must be the same repository.
    expect(decodeFrame(repoPage({ timeline: true }), '/repos/prebidserver')).toBeNull();
    expect(decodeFrame(contributor({ timeline: true }), '/contributors')).toBeNull();
  });

  it('allows the parent graph’s positions only', () => {
    expect(allowedParent(contributor({ timeline: true }), contributor())).toBe(true);
    expect(allowedParent(contributor({ timeline: true }), contributor({ timeline: true }))).toBe(
      false,
    );
    expect(
      allowedParent(company(), {
        route: '/contributors',
        segments: {},
        values: { timeline: true },
      }),
    ).toBe(true);
    expect(allowedParent(company(), summary())).toBe(false);
    expect(allowedParent(repoPage({ timeline: true }), summary({ timeline: true }))).toBe(true);
    expect(
      allowedParent(repoPage({ timeline: true }), {
        route: '/repos/[slug]/authors/[account]',
        segments: { slug: ['prebidjs'], account: ['bob'] },
        values: { metric: 'prAuthors' },
      }),
    ).toBe(true);
    expect(allowedParent(summary(), summary())).toBe(false);
  });
});

describe('resolveBack', () => {
  it('derives the parent when no frame is given', () => {
    expect(resolveBack(repoPage())).toEqual([
      { available: true, view: summary(), href: '/repos?v=1' },
    ]);
    expect(resolveBack(summary({ timeline: true, repo: ['prebidjs'] }))).toEqual([
      { available: true, view: summary({ repo: ['prebidjs'] }), href: '/repos?repo=prebidjs' },
    ]);
    expect(resolveBack(summary())).toEqual([]);
    expect(resolveBack(repoPage({ timeline: true }))).toEqual([]);
  });

  it('walks frames nearest first, carrying farther frames on each ancestor', () => {
    const timeline = repoPage({
      timeline: true,
      back: [
        '/repos/prebidjs~metric:prsOpened~period:this-month~at:2026-10-24T12:00Z',
        '~repo:prebidjs',
      ],
    });
    const [list, top, ...rest] = resolveBack(timeline);
    expect(list).toMatchObject({
      available: true,
      href: '/repos/prebidjs?period=this-month&at=2026-10-24T12:00Z&metric=prsOpened&back=~repo:prebidjs',
    });
    expect(top).toMatchObject({ available: true, href: '/repos?repo=prebidjs' });
    expect(rest).toEqual([]);
  });

  it('marks an unresolvable ancestor and every farther one unavailable', () => {
    expect(resolveBack(repoPage({ back: ['!'] }))).toEqual([{ available: false }]);
    expect(resolveBack(repoPage({ timeline: true, back: ['-'] }))).toEqual([{ available: false }]);
    expect(resolveBack(repoPage({ back: ['-', '-'] }))).toEqual([
      { available: true, view: summary(), href: '/repos?v=1' },
      { available: false },
    ]);
    const tooLong = 'x'.repeat(7600);
    expect(resolveBack(repoPage({ back: ['~q:' + tooLong] }))).toEqual([{ available: false }]);
  });

  it('inherits the parent of supporting and author views without using a frame', () => {
    const author: UrlView = {
      route: '/repos/[slug]/authors/[account]',
      segments: { slug: ['prebidjs'], account: ['bob'] },
      values: {
        metric: 'prAuthors',
        period: 'this-month',
        at: '2026-10-24T12:00Z',
        back: ['~repo:prebidjs'],
      },
    };
    const [list, top] = resolveBack(author);
    expect(list).toMatchObject({
      href: '/repos/prebidjs?period=this-month&at=2026-10-24T12:00Z&metric=prAuthors&back=~repo:prebidjs',
    });
    expect(top).toMatchObject({ href: '/repos?repo=prebidjs' });
  });
});

describe('withBack', () => {
  const frame = (length: number) => '~q:' + 'x'.repeat(length - 3);
  it('keeps frames within eight values and the 1,000-character share', () => {
    expect(withBack('/repos/prebidjs', ['~repo:a', '-'], 'child')).toBe(
      '/repos/prebidjs?back=~repo:a',
    );
    expect(withBack('/repos/prebidjs?view=issues#period-activity', ['~repo:a'], 'back')).toBe(
      '/repos/prebidjs?view=issues&back=~repo:a#period-activity',
    );
    expect(withBack('/x', ['-', '-'], 'child')).toBe('/x');
    // A dropped derived frame needs no mark: an absent frame means the derived parent.
    expect(withBack('/x', [frame(990), '-'], 'child')).toBe('/x?back=' + frame(990));
    expect(withBack('/x', [frame(995), frame(10)], 'child')).toBeNull();
  });

  it('marks the first dropped ancestor unavailable rather than deriving it', () => {
    const query = (frames: string[]) => '/x?' + frames.map((value) => 'back=' + value).join('&');
    // Past the eighth value: seven frames and the mark fill the eight.
    const nine = Array.from({ length: 9 }, (_, index) => '~p:' + index);
    expect(withBack('/x', nine, 'back')).toBe(query([...nine.slice(0, 7), '!']));
    expect(withBack('/x', nine, 'level')).toBe(query([...nine.slice(0, 7), '!']));
    expect(withBack('/x', [...nine.slice(0, 8), '-'], 'level')).toBe(query(nine.slice(0, 8)));
    // Over the 1,000-character share: 986 + 7 fits, 986 + 16 does not.
    expect(withBack('/x', [frame(980), frame(10)], 'child')).toBe(query([frame(980), '!']));
    // A derived frame before the first dropped one keeps the mark at its position.
    expect(withBack('/x', [frame(970), '-', frame(30)], 'child')).toBe(
      query([frame(970), '-', '!']),
    );
    expect(withBack('/x', [frame(995), '-', frame(10)], 'back')).toBe(query(['!']));
    // The immediate parent fits only without the mark its dropped parent needs: no link.
    expect(withBack('/x', [frame(990), frame(10)], 'child')).toBeNull();
    // A frame after an unavailable one is never resolved, so dropping it needs no second mark.
    expect(withBack('/x', [frame(980), '!', frame(30)], 'child')).toBe(query([frame(980), '!']));

    // A searched list whose frame takes 979 of the 1,000 characters.
    const list =
      '/repos/prebidjs~metric:prsOpened~period:this-month~at:2026-10-24T12:00Z~labels:' +
      'y'.repeat(447) +
      '~q:' +
      'x'.repeat(450);
    const kept = fitBack('/repos/prebidjs?timeline', [list, '~repo:prebidjs'], 'child');
    expect(kept).toEqual([list, '!']);
    const [parent, top, ...rest] = resolveBack(repoPage({ timeline: true, back: kept! }));
    expect(parent).toMatchObject({ available: true, view: { route: '/repos/[slug]' } });
    // Without the mark this crumb would open the derived Summary, a broader report.
    expect(top).toEqual({ available: false });
    expect(rest).toEqual([]);
  });

  it('exempts the first frame of the page’s own address from the share but not the cap', () => {
    expect(withBack('/x', [frame(5000), frame(10)], 'level')).toBe(
      '/x?back=' + frame(5000) + '&back=' + frame(10),
    );
    expect(withBack('/x', [frame(7600)], 'level')).toBeNull();
    expect(withBack('/' + 'x'.repeat(7600), [], 'back')).toBeNull();
  });
});

it('compares views without return context, version or fragment', () => {
  expect(sameView('/repos?v=1', '/repos')).toBe(true);
  expect(sameView('/repos?b=1&a=2#x', '/repos?a=2&b=1&back=-')).toBe(true);
  expect(sameView('/repos/prebid%6As', '/repos/prebidjs')).toBe(true);
  expect(sameView('/repos?a=1', '/repos?a=2')).toBe(false);
  expect(sameView('/repos', '/contributors')).toBe(false);
  expect(sameView(null, '/repos')).toBe(false);
  expect(sameView('https://evil.example/repos', '/repos')).toBe(false);
});

describe('rebaseBack', () => {
  it('keeps the resolved parent when the child’s own state changes', () => {
    const before = summary({ timeline: true, repo: ['prebidjs'] });
    // The Summary derived from the old repository selection stays the parent.
    expect(rebaseBack(before, summary({ timeline: true, repo: ['prebidserver'] }))).toEqual([
      '~repo:prebidjs',
    ]);
    expect(
      rebaseBack(before, summary({ timeline: true, repo: ['prebidjs'], group: 'week' })),
    ).toEqual(['-']);
    expect(
      rebaseBack(
        summary({ timeline: true, back: ['~period2:last-month', 'x'] }),
        summary({ timeline: true, group: 'week' }),
      ),
    ).toEqual(['~period2:last-month', 'x']);
  });

  it('keeps inherited, top-level and unavailable parents as they are', () => {
    expect(rebaseBack(summary(), summary({ age: [] }))).toEqual([]);
    const author: UrlView = {
      route: '/repos/[slug]/authors/[account]',
      segments: { slug: ['prebidjs'], account: ['bob'] },
      values: { metric: 'prAuthors', back: ['~repo:a'] },
    };
    expect(rebaseBack(author, author)).toEqual(['~repo:a']);
    expect(rebaseBack(repoPage({ back: ['!', '~a:1'] }), repoPage({ sort: 'number' }))).toEqual([
      '!',
      '~a:1',
    ]);
    expect(
      rebaseBack(repoPage({ timeline: true }), repoPage({ timeline: true, group: 'week' })),
    ).toEqual([]);
  });
});
