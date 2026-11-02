// The URL codec (architecture rule 6): parse a query into registry values and write values back as
// the one canonical query. Pure; the only `URLSearchParams` construction outside `legacy/`.
import type { PageSearchParams } from '../search-params';
import { allRepositorySlugs, defaultValue, urlVersion } from './defaults';
import {
  paramFor,
  routeKinds,
  routePath,
  screenOf,
  screenParams,
  urlParamNames,
  urlPeriodPresets,
  type UrlParam,
  type UrlRoute,
  type UrlScreen,
  type UrlSegments,
  type UrlValue,
  type UrlValues,
} from './registry';

export type QueryPair = readonly [string, string];
export type QueryInput = PageSearchParams | URLSearchParams | string | readonly QueryPair[];

/** Decoded key/value pairs in order; a page's search params arrive decoded, repeated keys as arrays. */
export function queryPairs(input: QueryInput): QueryPair[] {
  if (typeof input === 'string' || input instanceof URLSearchParams)
    return [...new URLSearchParams(input)];
  if (Array.isArray(input)) return [...(input as readonly QueryPair[])];
  return Object.entries(input as PageSearchParams).flatMap(([key, value]) =>
    value === undefined
      ? []
      : (Array.isArray(value) ? value : [value]).map((item) => [key, item] as const),
  );
}

/** Keys and value forms the frozen readers read and the registry does not (decoded by `legacy/`). */
const legacyKey =
  /^(?:scope|from|through|from2|through2|to|inclusive|branch|population|returnTo|summary|timelineParent|nav|change|entityId|column)$|^(?:timeline|support|prs|issues|authors|credits|report|members|repositories|details|contributors|companies|backlog|activity|export)\./;
/** Registry lists that the frozen readers wrote as one repeated key per item. */
const legacyRepeated: ReadonlySet<string> = new Set([
  'repo',
  'age',
  'type',
  'account',
  'company',
  'exclude',
]);
/** Whether a query key belongs to the legacy (pre-codec) URL forms. */
export function isLegacyKey(key: string): boolean {
  return legacyKey.test(key);
}

const listItem = /^[A-Za-z0-9._~:@-]+$/;
const columnToken = /^-?[A-Za-z0-9._]+$/;
const instantPattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z)?$/;
const periodRange = /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/;
const frameValue = /^[A-Za-z0-9\-._,:@*!/~]+$/;
const textLimit = 500;

export type ParsedQuery =
  | { kind: 'canonical'; screen: UrlScreen; values: UrlValues }
  /** Holds a legacy key or value form: decode it with `legacyDecode` and answer with a 307. */
  | { kind: 'noncanonical' }
  /** Unknown parameter or malformed value: render the screen's invalid view, never redirect. */
  | { kind: 'invalid'; message: string };

const invalid = (message: string): ParsedQuery => ({ kind: 'invalid', message });
export const unknownParameterMessage = 'This link has a parameter this view does not accept.';

const legacyForm = { legacy: true } as const;
/** A canonical value of a parameter, `legacyForm` for a pre-codec spelling, or null when malformed. */
function readValue(entry: UrlParam, raw: readonly string[]): UrlValue | typeof legacyForm | null {
  if (entry.kind === 'textList') return raw.every((item) => item.length <= textLimit) ? raw : null;
  if (entry.kind === 'frames') return raw.every((item) => frameValue.test(item)) ? raw : null;
  if (raw.length !== 1)
    return entry.kind === 'list' && legacyRepeated.has(entry.name) ? legacyForm : null;
  const [value] = raw;
  switch (entry.kind) {
    case 'flag':
      return value === '' ? true : entry.name === 'timeline' && value === '1' ? legacyForm : null;
    case 'enum':
      return entry.values!.includes(value) ? value : null;
    case 'text':
      return value.length <= textLimit ? value : null;
    case 'int':
      return /^[1-9]\d{0,8}$/.test(value) ? value : null;
    case 'version':
      return value === urlVersion ? value : null;
    case 'period':
      return urlPeriodPresets.includes(value) || periodRange.test(value)
        ? value
        : value === 'custom'
          ? legacyForm
          : null;
    case 'instant':
      return instantPattern.test(value) ? value : null;
    case 'sort':
      return columnToken.test(value) ? value : null;
    case 'cols': {
      const tokens = value === '' ? [] : value.split(',');
      return tokens.every((token) => columnToken.test(token)) ? tokens : null;
    }
    case 'interval': {
      const split = value.indexOf(':');
      return split > 0 &&
        /^[a-z-]+$/.test(value.slice(0, split)) &&
        instantPattern.test(value.slice(split + 1))
        ? value
        : null;
    }
    case 'snap': {
      const split = value.lastIndexOf('@');
      return split > 0 && split <= textLimit && instantPattern.test(value.slice(split + 1))
        ? value
        : null;
    }
    case 'list': {
      const items = value === '' ? [] : value.split(',');
      if (!items.every((item) => listItem.test(item))) return null;
      if (entry.name === 'repo' && items.some(isLegacyRepositoryId)) return legacyForm;
      if (entry.values && !items.every((item) => entry.values!.includes(item))) return null;
      return items;
    }
  }
}
/** A catalog ID (`repo-<slug>`) that is not itself a slug: the frozen readers' repository form. */
function isLegacyRepositoryId(item: string): boolean {
  const slugs = allRepositorySlugs();
  return !slugs.includes(item) && item.startsWith('repo-') && slugs.includes(item.slice(5));
}

/**
 * Read a query for a route. Canonical values may still be spelled non-canonically (a default
 * written out, a list out of order); compare `urlHref(...)` with the request to find those.
 */
export function parseQuery(route: UrlRoute, input: QueryInput): ParsedQuery {
  const pairs = queryPairs(input);
  const grouped = new Map<string, string[]>();
  for (const [key, value] of pairs) grouped.set(key, [...(grouped.get(key) ?? []), value]);
  if ([...grouped.keys()].some(isLegacyKey)) return { kind: 'noncanonical' };
  // Selectors decide the screen, and the screen decides which other names are accepted.
  const preliminary: Record<string, UrlValue> = {};
  for (const name of ['timeline', 'detail', 'metric'])
    if (grouped.has(name)) preliminary[name] = name === 'timeline' ? true : grouped.get(name)![0];
  const screen = screenOf(route, preliminary);
  const values: Record<string, UrlValue> = {};
  let legacy = false;
  for (const [name, raw] of grouped) {
    const entry = paramFor(route, screen, name);
    if (!entry) return invalid(unknownParameterMessage);
    const value = readValue(entry, raw);
    if (value === null) return invalid('This link has an invalid ' + name + ' value.');
    if (typeof value === 'object' && 'legacy' in value) legacy = true;
    else values[name] = value;
  }
  if (legacy) return { kind: 'noncanonical' };
  return { kind: 'canonical', screen, values };
}

/** Percent-encode a value, keeping `,` `:` `@` and `/` literal (they are safe in a query). */
export function encodeQueryValue(value: string): string {
  return encodeURIComponent(value)
    .replaceAll('%2C', ',')
    .replaceAll('%3A', ':')
    .replaceAll('%40', '@')
    .replaceAll('%2F', '/');
}
const sameValue = (a: UrlValue | undefined, b: UrlValue | undefined) =>
  a === b ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((item, index) => item === b[index]));
const unique = (items: readonly string[]) => [...new Set(items)];
/** Lists whose order carries no meaning are written in one order, so one view has one URL. */
function ordered(entry: UrlParam, items: readonly string[]): readonly string[] {
  switch (entry.name) {
    case 'repo': {
      const slugs = allRepositorySlugs();
      const known = slugs.filter((slug) => items.includes(slug));
      return [...known, ...unique(items).filter((item) => !slugs.includes(item))];
    }
    case 'age':
      return unique(items).sort((a, b) => Number(a) - Number(b));
    case 'account':
    case 'company':
    case 'exclude':
      return unique(items).sort();
    default:
      return entry.values ? entry.values.filter((value) => items.includes(value)) : unique(items);
  }
}

export interface SerializeOptions {
  /**
   * Pin the v1 defaults: write `v=1` when nothing but selectors and return context remains, so the
   * URL never redirects to a saved view (decision 5). Values holding `v` are pinned already.
   */
  explicit?: boolean;
}
/** Values with every field equal to its v1 default removed. */
export function withoutDefaults(route: UrlRoute, values: UrlValues): UrlValues {
  const screen = screenOf(route, values);
  const result: Record<string, UrlValue> = {};
  for (const [name, value] of Object.entries(values)) {
    const entry = paramFor(route, screen, name);
    const comparable = entry && Array.isArray(value) ? ordered(entry, value) : value;
    if (name === 'v' || !sameValue(comparable, defaultValue(route, name, values, screen)))
      result[name] = value;
  }
  return result;
}
/** The canonical query for values (no leading `?`): registry order, defaults omitted. */
export function serializeQuery(
  route: UrlRoute,
  values: UrlValues,
  options: SerializeOptions = {},
): string {
  const screen = screenOf(route, values);
  const kept = withoutDefaults(route, values);
  const parts: string[] = [];
  let onlySelectors = true;
  for (const entry of screenParams(route, screen)) {
    const value = kept[entry.name];
    if (value === undefined || entry.name === 'v') continue;
    if (entry.domain !== 'selector' && entry.domain !== 'return') onlySelectors = false;
    if (value === true) parts.push(entry.name);
    else if (typeof value === 'string') parts.push(entry.name + '=' + encodeQueryValue(value));
    else if (entry.kind === 'textList' || entry.kind === 'frames')
      for (const item of value) parts.push(entry.name + '=' + encodeQueryValue(item));
    else parts.push(entry.name + '=' + ordered(entry, value).map(encodeQueryValue).join(','));
  }
  if (
    onlySelectors &&
    (options.explicit || values.v !== undefined) &&
    routeKinds[route] !== 'export'
  )
    parts.push('v=' + urlVersion);
  return parts.join('&');
}
export interface HrefOptions extends SerializeOptions {
  /** A fragment, without `#`. */
  hash?: string;
}
/** The canonical href of a route's view. */
export function urlHref(
  route: UrlRoute,
  segments: UrlSegments,
  values: UrlValues,
  options: HrefOptions = {},
): string {
  const query = serializeQuery(route, values, options);
  return (
    routePath(route, segments) +
    (query ? '?' + query : '') +
    (options.hash ? '#' + options.hash : '')
  );
}
/** Order-insensitive comparison of decoded key/value pairs (`?timeline` equals `?timeline=`). */
export function sameQuery(a: QueryInput, b: QueryInput): boolean {
  const key = (input: QueryInput) =>
    queryPairs(input)
      .map(([name, value]) => JSON.stringify([name, value]))
      .sort()
      .join('&');
  return key(a) === key(b);
}
/**
 * An entry: a report route whose query holds only view selectors and return context, and no `v`
 * (decision C1). Saved values apply only on entries; every other URL is explicit.
 */
export function isEntry(route: UrlRoute, values: UrlValues): boolean {
  if (routeKinds[route] === 'export' || route === '/repos/[slug]/authors/[account]') return false;
  const screen = screenOf(route, values);
  return Object.keys(values).every((name) => {
    const domain = paramFor(route, screen, name)?.domain;
    return domain === 'selector' || domain === 'return';
  });
}
/** Whether a name is a registry parameter on any route. */
export function isRegistryName(name: string): boolean {
  return urlParamNames.has(name);
}
