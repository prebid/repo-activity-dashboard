import { describe, expect, it } from 'vitest';
import { preferenceSectionKeys, type PreferenceSectionKey } from '@/models/preferences';
import {
  cookieValue,
  decodePreferenceCookie,
  encodePreferenceDocument,
  fitPreferenceCookie,
  preferenceCookieByteLimit,
  preferenceCookieBytes,
  preferenceCookieString,
  preferenceCookies,
  preferenceCookieVersion,
  preferenceSectionCookie,
  preferenceSectionText,
  samePreferenceBinding,
  withPreferenceSection,
  type PreferenceDocument,
} from '@/lib/presentation/preference-cookie';

const alice = { accountId: 'alice', authVersion: 3 };
const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('cookie names, paths and attributes', () => {
  it('scopes both cookies to the whole site', () => {
    expect(preferenceCookies).toEqual({
      repositories: { name: 'dashboard-repositories', path: '/' },
      contributions: { name: 'dashboard-contributions', path: '/' },
    });
    expect(preferenceCookieVersion).toBe(1);
    expect(preferenceCookieByteLimit).toBe(3072);
  });
  it('writes a script-readable, SameSite=Lax cookie that is Secure only on HTTPS', () => {
    expect(preferenceCookieString('repositories', 'abc', false)).toBe(
      'dashboard-repositories=abc; Path=/; Max-Age=31536000; SameSite=Lax',
    );
    expect(preferenceCookieString('contributions', 'abc', true)).toBe(
      'dashboard-contributions=abc; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
    );
    expect(preferenceCookieString('contributions', null, false)).toBe(
      'dashboard-contributions=; Path=/; Max-Age=0; SameSite=Lax',
    );
    expect(preferenceCookieString('repositories', 'abc', true)).not.toMatch(/HttpOnly/i);
  });
  it('places every section in exactly one cookie and keys none by repository or sample', () => {
    const all = [...preferenceSectionKeys.repositories, ...preferenceSectionKeys.contributions];
    expect(new Set(all).size).toBe(all.length);
    for (const section of preferenceSectionKeys.repositories)
      expect(preferenceSectionCookie(section)).toBe('repositories');
    for (const section of preferenceSectionKeys.contributions)
      expect(preferenceSectionCookie(section)).toBe('contributions');
    expect(all.join(' ')).not.toMatch(/prebid|repo-|reference|sample|account-|company-/);
  });
  it('reads the first value for a cookie name from a document.cookie string', () => {
    expect(
      cookieValue(
        'dashboard-theme=dark; dashboard-repositories=first; dashboard-repositories=second',
        'repositories',
      ),
    ).toBe('first');
    expect(cookieValue('x-dashboard-repositories=no', 'repositories')).toBeUndefined();
    expect(cookieValue('', 'contributions')).toBeUndefined();
  });
});

describe('section codec and account binding', () => {
  it('round-trips sections with their update order', () => {
    let document = withPreferenceSection(null, alice, 'overview', { version: 3, settings: {} });
    document = withPreferenceSection(document, alice, 'overview.backlog.sort', {
      sort: 'name',
      descending: true,
    });
    const read = decodePreferenceCookie('repositories', encodePreferenceDocument(document), alice);
    expect(read).toEqual({ status: 'bound', document });
    expect(document.sections.overview!.updated).toBeLessThan(
      document.sections['overview.backlog.sort']!.updated,
    );
    expect(preferenceSectionText(document, 'overview.backlog.sort')).toBe(
      '{"sort":"name","descending":true}',
    );
    expect(preferenceSectionText(document, 'repository.prs.sort')).toBeNull();
    expect(preferenceSectionText(null, 'overview')).toBeNull();
  });
  it('round-trips non-ASCII values and account IDs', () => {
    const binding = { accountId: 'ålice@example.test', authVersion: 0 };
    const document = withPreferenceSection(null, binding, 'contributions.scope', { q: 'Zoë ✓' });
    expect(
      decodePreferenceCookie('contributions', encodePreferenceDocument(document), binding),
    ).toEqual({ status: 'bound', document });
  });
  it('replaces one section, removes it with null, and leaves the others untouched', () => {
    let document = withPreferenceSection(null, alice, 'overview', 1);
    document = withPreferenceSection(document, alice, 'repository.prs.sort', 2);
    const rewritten = withPreferenceSection(document, alice, 'overview', 3);
    expect(rewritten.sections['repository.prs.sort']).toEqual(
      document.sections['repository.prs.sort'],
    );
    expect(rewritten.sections.overview).toEqual({ updated: 2, value: 3 });
    expect(Object.keys(withPreferenceSection(rewritten, alice, 'overview', null).sections)).toEqual(
      ['repository.prs.sort'],
    );
    expect(document.sections.overview).toEqual({ updated: 0, value: 1 });
  });
  it('starts a fresh document for another session or cookie', () => {
    const document = withPreferenceSection(null, alice, 'overview', 1);
    const bob = { accountId: 'bob', authVersion: 3 };
    expect(withPreferenceSection(document, bob, 'repository.prs.sort', 2).sections).toEqual({
      'repository.prs.sort': { updated: 0, value: 2 },
    });
    expect(
      withPreferenceSection(document, { ...alice, authVersion: 4 }, 'overview', 2).sections,
    ).toEqual({ overview: { updated: 0, value: 2 } });
    expect(withPreferenceSection(document, alice, 'contributions.scope', 2)).toEqual({
      cookie: 'contributions',
      binding: alice,
      sections: { 'contributions.scope': { updated: 0, value: 2 } },
    });
    expect(samePreferenceBinding(alice, { ...alice })).toBe(true);
    expect(samePreferenceBinding(alice, bob)).toBe(false);
  });
  it('ignores a value saved for another account, revision or format version', () => {
    const value = encodePreferenceDocument(withPreferenceSection(null, alice, 'overview', 1));
    expect(
      decodePreferenceCookie('repositories', value, { accountId: 'bob', authVersion: 3 }),
    ).toEqual({ status: 'ignored', reason: 'account' });
    expect(decodePreferenceCookie('repositories', value, { ...alice, authVersion: 4 })).toEqual({
      status: 'ignored',
      reason: 'revision',
    });
    const future = toBase64Url(JSON.stringify({ v: 2, a: 'alice', r: 3, s: {}, extra: true }));
    expect(decodePreferenceCookie('repositories', future, alice)).toEqual({
      status: 'ignored',
      reason: 'version',
    });
  });
  it.each([
    ['not base64url', 'a+b/c'],
    ['not JSON', toBase64Url('{')],
    ['not UTF-8', 'gA'],
    ['no version', toBase64Url('{"a":"alice","r":3,"s":{}}')],
    ['a missing revision', toBase64Url('{"v":1,"a":"alice","s":{}}')],
    ['an extra field', toBase64Url('{"v":1,"a":"alice","r":3,"s":{},"x":1}')],
    ['a malformed section', toBase64Url('{"v":1,"a":"alice","r":3,"s":{"overview":[-1,{}]}}')],
    ['a section without a stamp', toBase64Url('{"v":1,"a":"alice","r":3,"s":{"overview":{}}}')],
  ])('treats a value with %s as malformed', (_label, raw) => {
    expect(decodePreferenceCookie('repositories', raw, alice)).toEqual({ status: 'malformed' });
  });
  it('reads an absent cookie and drops sections the cookie cannot hold', () => {
    expect(decodePreferenceCookie('repositories', undefined, alice)).toEqual({ status: 'absent' });
    expect(decodePreferenceCookie('repositories', '', alice)).toEqual({ status: 'absent' });
    const raw = toBase64Url(
      JSON.stringify({
        v: 1,
        a: 'alice',
        r: 3,
        s: { overview: [1, { a: 1 }], 'contributions.scope': [2, {}], retired: [3, {}] },
      }),
    );
    expect(decodePreferenceCookie('repositories', raw, alice)).toEqual({
      status: 'bound',
      document: {
        cookie: 'repositories',
        binding: alice,
        sections: { overview: { updated: 1, value: { a: 1 } } },
      },
    });
  });
});

describe('byte cap and eviction', () => {
  const sections = preferenceSectionKeys.repositories.slice(0, 6) as PreferenceSectionKey[];
  function full(size: number) {
    let document: PreferenceDocument | null = null;
    for (const section of sections)
      document = withPreferenceSection(document, alice, section, 'x'.repeat(size));
    return document!;
  }
  it('measures the name, the separator and the value in UTF-8 bytes', () => {
    expect(preferenceCookieBytes('repositories', 'é')).toBe('dashboard-repositories='.length + 2);
  });
  it('keeps a document that fits and deletes the cookie when no section remains', () => {
    const document = full(10);
    const fit = fitPreferenceCookie(document, 'overview');
    expect(fit).toEqual({
      status: 'fits',
      value: encodePreferenceDocument(document),
      document,
      evicted: [],
    });
    expect(
      fitPreferenceCookie({ cookie: 'repositories', binding: alice, sections: {} }),
    ).toMatchObject({ status: 'fits', value: null, evicted: [] });
  });
  it('evicts least recently updated sections first, never the one being written', () => {
    // Six 700-byte sections need about 5,600 encoded bytes; three fit under the cap.
    let document = full(700);
    // Rewriting the oldest section makes it the newest.
    document = withPreferenceSection(document, alice, sections[0], 'y'.repeat(700));
    const fit = fitPreferenceCookie(document, sections[0]);
    if (fit.status !== 'fits') throw Error('Expected a fit');
    expect(fit.evicted).toEqual([sections[1], sections[2], sections[3]]);
    expect(Object.keys(fit.document.sections).sort()).toEqual(
      [sections[0], sections[4], sections[5]].sort(),
    );
    expect(preferenceCookieBytes('repositories', fit.value!)).toBeLessThanOrEqual(3072);
    expect(fitPreferenceCookie(document, sections[5])).toMatchObject({
      evicted: [sections[1], sections[2], sections[3]],
    });
  });
  it('reads a value at the cap and treats a longer one as malformed without decoding it', () => {
    const value = (size: number) =>
      encodePreferenceDocument(withPreferenceSection(null, alice, 'overview', 'x'.repeat(size)));
    let size = 2000;
    while (preferenceCookieBytes('repositories', value(size + 1)) <= preferenceCookieByteLimit)
      size++;
    expect(
      fitPreferenceCookie(withPreferenceSection(null, alice, 'overview', 'x'.repeat(size))),
    ).toMatchObject({ status: 'fits', evicted: [] });
    expect(decodePreferenceCookie('repositories', value(size), alice)).toMatchObject({
      status: 'bound',
    });
    expect(decodePreferenceCookie('repositories', value(size + 1), alice)).toEqual({
      status: 'malformed',
    });
    // A deeply nested value is refused by its length before any parsing.
    const nested = toBase64Url('['.repeat(20_000) + ']'.repeat(20_000));
    expect(decodePreferenceCookie('repositories', nested, alice)).toEqual({ status: 'malformed' });
    expect(decodePreferenceCookie('contributions', 'a+'.repeat(2000), alice)).toEqual({
      status: 'malformed',
    });
  });
  it('refuses a section that alone exceeds the cap', () => {
    const document = withPreferenceSection(full(10), alice, 'overview', 'z'.repeat(4000));
    expect(fitPreferenceCookie(document, 'overview')).toEqual({ status: 'too-large' });
  });
  it('breaks equal stamps by section name so eviction is deterministic', () => {
    const document: PreferenceDocument = {
      cookie: 'repositories',
      binding: alice,
      sections: {
        'repository.prs.sort': { updated: 0, value: 'a'.repeat(1500) },
        overview: { updated: 0, value: 'b'.repeat(1500) },
      },
    };
    expect(fitPreferenceCookie(document)).toMatchObject({ evicted: ['overview'] });
  });
});
