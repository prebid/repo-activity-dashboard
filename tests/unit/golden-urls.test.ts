import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  derive,
  resolveBack,
  viewHref,
  viewPairs,
  type UrlView,
} from '@/lib/presentation/url/back';
import { parseQuery, urlHref } from '@/lib/presentation/url/codec';
import { legacyDecode } from '@/lib/presentation/url/legacy/decode';
import { legacyState, type LegacyState } from '@/lib/presentation/url/legacy/state';
import { matchRoute, type UrlRoute } from '@/lib/presentation/url/registry';
import { legacyContext } from '@/server/legacy-context';
import { linkKindParts, stableJson, type GoldenUrls } from '../support/golden-urls';
import { legacyQuery } from '../support/legacy-query';

// The P5a golden set: every link and address the inventory showed before the codec. Each URL
// resolves through the frozen readers to the state its page rendered on a first visit (the
// recorded states must never change), decodes to registry values, and round-trips: the canonical
// URL renders the same state.

const golden = JSON.parse(
  readFileSync('tests/fixtures/golden/legacy-urls.json', 'utf8'),
) as GoldenUrls;
const context = legacyContext();
const origin = 'https://dashboard.invalid';

/** Every recorded URL with the route pattern that served it. */
function goldenUrls(): Map<string, string> {
  const urls = new Map<string, string>();
  const add = (route: string, href: string) => {
    if (!urls.has(href)) urls.set(href, route);
  };
  for (const view of Object.values(golden.views)) {
    add(view.route, view.requested);
    add(view.route, view.address);
    for (const [kind, link] of Object.entries(view.links))
      add(linkKindParts(kind).route, link.example);
  }
  add('/repos', golden.scopeChange.address);
  return urls;
}
const urls = goldenUrls();

/** Return context becomes `back` frames; until then the states are compared without it. */
function withoutReturnContext(state: LegacyState): unknown {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, item]) =>
            !['trail', 'returnTo', 'summary', 'href'].includes(key) &&
            !(key === 'parent' && (item === null || typeof item === 'string')),
        )
        .map(([key, item]) => [key, strip(item)]),
    );
  };
  return strip(state);
}
const branch = (pathname: string) =>
  context.catalogIdentity(decodeURIComponent(pathname.split('/')[2]))!.primaryBranch;

function canonicalFor(route: UrlRoute, href: string) {
  const url = new URL(href, origin);
  const { segments } = matchRoute(url.pathname)!;
  const decoded = legacyDecode(route, segments, url.search, context);
  return decoded.kind === 'values'
    ? {
        segments,
        values: decoded.values,
        href: viewHref({ route, segments, values: decoded.values }, 'level')!,
      }
    : { segments, invalid: decoded.message };
}
/** The return chain the frozen readers recorded for a URL: absolute legacy hrefs, nearest first. */
function recordedChain(state: Record<string, unknown>, href: string): string[] {
  const params = new URL(href, origin).searchParams;
  if ('support' in state)
    return recordedChain(
      (state.parent as { state: Record<string, unknown> }).state,
      (state.parent as { href: string }).href,
    );
  if (Array.isArray(state.trail)) return state.trail as string[];
  if (params.has('summary')) return [state.summary as string];
  if (params.has('timelineParent')) return [state.parent as string];
  if (params.has('returnTo')) {
    const entry = (state.entry ?? state.drilldown) as {
      drilldown?: { returnTo: string };
      value?: { returnTo: string };
    };
    return [(entry.drilldown ?? entry.value)!.returnTo];
  }
  return [];
}
/** Ancestors past the inherited ones (supporting views and author records keep their parent's). */
function inheritedLevels(view: UrlView): number {
  let levels = 0;
  for (let derivation = derive(view); derivation.kind === 'inherit'; levels++)
    derivation = derive(derivation.parent);
  return levels;
}

it('resolves every golden URL to the state its page renders through the frozen readers', async () => {
  const states: Record<string, ReturnType<typeof legacyState>> = {};
  for (const [href, route] of urls) states[href] = legacyState(route, href, context);
  await expect(stableJson(states)).toMatchFileSnapshot('../fixtures/golden/golden-url-states.json');
});

describe('legacy decode', () => {
  const reportUrls = [...urls].filter(([href]) => matchRoute(new URL(href, origin).pathname));

  it('records the canonical URL of every golden URL', async () => {
    const canonical: Record<string, string> = {};
    for (const [href, route] of reportUrls) {
      const result = canonicalFor(route as UrlRoute, href);
      canonical[href] = result.href ?? 'invalid: ' + result.invalid;
    }
    await expect(stableJson(canonical)).toMatchFileSnapshot(
      '../fixtures/golden/golden-url-canonical.json',
    );
  });

  it.each(reportUrls)('round-trips %s', (href, route) => {
    const typed = route as UrlRoute;
    const result = canonicalFor(typed, href);
    expect(result.invalid).toBeUndefined();
    const url = new URL(result.href!, origin);
    // The canonical URL parses as canonical and serializes to itself (no redirect loop).
    const parsed = parseQuery(typed, url.search);
    expect(parsed.kind).toBe('canonical');
    if (parsed.kind !== 'canonical') return;
    expect(urlHref(typed, result.segments, parsed.values)).toBe(result.href);
    // It renders the state the legacy URL rendered.
    const replayed = legacyQuery(typed, url.pathname, parsed.values, {
      asOf: context.asOf,
      branch,
    });
    expect(withoutReturnContext(legacyState(typed, replayed, context).state)).toEqual(
      withoutReturnContext(legacyState(typed, href, context).state),
    );
    // Its back frames restore the return chain the legacy URL carried.
    const view = { route: typed, segments: result.segments, values: parsed.values };
    const ancestors = resolveBack(view).slice(inheritedLevels(view));
    const chain = recordedChain(
      legacyState(typed, href, context).state as Record<string, unknown>,
      href,
    );
    chain.forEach((ancestor, index) => {
      const target = new URL(ancestor, origin);
      const matched = matchRoute(target.pathname)!;
      for (const key of ['returnTo', 'summary', 'timelineParent', 'nav'])
        target.searchParams.delete(key);
      const decoded = legacyDecode(matched.route, matched.segments, target.search, context);
      if (decoded.kind !== 'values') throw Error('Ancestor does not decode: ' + ancestor);
      const restored = ancestors[index];
      expect(restored?.available, ancestor).toBe(true);
      if (!restored?.available) return;
      expect(restored.view.route).toBe(matched.route);
      expect(viewPairs(restored.view)).toEqual(viewPairs({ ...matched, values: decoded.values }));
    });
  });
});
