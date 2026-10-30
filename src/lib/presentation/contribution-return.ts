import { z } from 'zod';
import { safeReturnPath } from './navigation';
import { contributionScopeKeys } from './contribution-settings';

export const contributionUrlLimit = 7500;
export const contributionLinkLimitMessage =
  'This selection is too large for a detail link. Narrow the filters or search and try again.';
export const contributionChangeLimitMessage =
  'This change is too large for the report URL. Reduce the selection and try again.';
const frameLimit = 8;
const valueLimit = 512;
const poolLimit = 256;
// Bound materialized UTF-16 units before expanding compact values. Each restored
// frame is also checked against the stricter encoded URL byte budget before append.
const expansionLimit = frameLimit * contributionUrlLimit;
const origin = 'https://dashboard.invalid';
type Frame = { path: string; params: URLSearchParams };
// Each parameter value is stored once across the trail. Frames are independent snapshots:
// changing the current filters never changes an ancestor's scope or presentation.
const literalValues = z.array(z.string().max(contributionUrlLimit)).min(1).max(valueLimit);
const compactValues = z
  .object({
    p: z.string().min(1).max(contributionUrlLimit),
    w: z.number().int().positive().max(contributionUrlLimit),
    s: z.string().min(1).max(contributionUrlLimit),
  })
  .strict()
  .refine((value) => value.s.length % value.w === 0 && value.s.length / value.w <= valueLimit);
type PackedValues = string[] | z.infer<typeof compactValues>;
const framesSchema = z
  .array(
    z.tuple([
      z.string().max(contributionUrlLimit),
      z.array(z.tuple([z.string().max(100), z.number().int().nonnegative()])).max(64),
    ]),
  )
  .max(frameLimit);
const legacyTrailSchema = z.tuple([
  z.literal(1),
  z.array(literalValues).max(poolLimit),
  framesSchema,
]);
const trailSchema = z.tuple([
  z.literal(2),
  z.array(z.union([literalValues, compactValues])).max(poolLimit),
  framesSchema,
]);
const scopeKeys: ReadonlySet<string> = new Set([
  ...contributionScopeKeys,
  'sample',
  'view',
  'metric',
  'members.zero',
]);
function returnParameter(key: string): boolean {
  return (
    scopeKeys.has(key) ||
    /^(report|contributors|companies|members|repositories|details)\.(q|sort|dir|page|columns)$/.test(
      key,
    )
  );
}
export function contributionUrlFits(href: string): boolean {
  return new TextEncoder().encode(href).length <= contributionUrlLimit;
}
export function safeContributionReturn(value: string | null | undefined, fallback: string): string {
  if (!value || !contributionUrlFits(value)) return fallback;
  const path = safeReturnPath(value);
  return contributionUrlFits(path) && /^\/(contributors|companies)(?:[/?#]|$)/.test(path)
    ? path
    : fallback;
}
function frame(href: string): Frame | null {
  const safe = safeContributionReturn(href, '');
  if (!safe) return null;
  const url = new URL(safe, origin);
  url.searchParams.delete('nav');
  url.searchParams.delete('returnTo');
  for (const key of [...url.searchParams.keys()])
    if (!returnParameter(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return { path: url.pathname, params: url.searchParams };
}
/** Compact equal-width suffixes behind a shared prefix; other lists remain literal. */
function packValues(values: string[]): PackedValues {
  if (values.length < 2) return values;
  let prefix = values[0];
  for (const value of values.slice(1)) {
    let length = 0;
    while (length < prefix.length && prefix[length] === value[length]) length++;
    prefix = prefix.slice(0, length);
  }
  // Never generate a prefix ending halfway through a Unicode surrogate pair.
  const last = prefix.charCodeAt(prefix.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) prefix = prefix.slice(0, -1);
  const width = values[0].length - prefix.length;
  if (!prefix || !width || values.some((value) => value.length - prefix.length !== width))
    return values;
  const packed = {
    p: prefix,
    w: width,
    s: values.map((value) => value.slice(prefix.length)).join(''),
  };
  const size = (value: PackedValues) => new TextEncoder().encode(JSON.stringify(value)).length;
  return size(packed) < size(values) ? packed : values;
}
function unpackValues(pool: PackedValues[]): string[][] {
  let units = 0;
  for (const value of pool) {
    units += Array.isArray(value)
      ? value.reduce((sum, item) => sum + item.length, 0)
      : value.p.length * (value.s.length / value.w) + value.s.length;
    if (units > expansionLimit) throw Error('Return values exceed expansion budget');
  }
  return pool.map((value) => {
    const values = Array.isArray(value)
      ? value
      : Array.from(
          { length: value.s.length / value.w },
          (_, index) => value.p + value.s.slice(index * value.w, (index + 1) * value.w),
        );
    // URLSearchParams replaces lone surrogates; reject them instead of altering an ID.
    for (const item of values) encodeURIComponent(item);
    return values;
  });
}
function encode(frames: Frame[]): string | null {
  const values: string[][] = [];
  const indices = new Map<string, number>();
  const packed: z.infer<typeof framesSchema> = [];
  for (const { path, params } of frames) {
    const entries: [string, number][] = [];
    for (const key of new Set(params.keys())) {
      const value = params.getAll(key),
        identity = JSON.stringify(value);
      if (value.length > valueLimit) return null;
      let index = indices.get(identity);
      if (index === undefined) {
        if (values.length >= poolLimit) return null;
        index = values.length;
        indices.set(identity, index);
        values.push(value);
      }
      entries.push([key, index]);
    }
    packed.push([path, entries]);
  }
  const bytes = new TextEncoder().encode(JSON.stringify([2, values.map(packValues), packed]));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}
function decode(raw: string): Frame[] {
  if (!raw || raw.length > contributionUrlLimit || !/^[\w-]+$/.test(raw)) return [];
  try {
    const bytes = Uint8Array.from(atob(raw.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
      c.charCodeAt(0),
    );
    const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const [, pool, frames] =
      Array.isArray(input) && input[0] === 1
        ? legacyTrailSchema.parse(input)
        : trailSchema.parse(input);
    const values = unpackValues(pool);
    return frames.map(([path, entries]) => {
      if (safeContributionReturn(path, '') !== path || path.includes('?') || path.includes('#'))
        throw Error('Invalid return path');
      const params = new URLSearchParams();
      let size = new TextEncoder().encode(path).length;
      for (const [key, index] of entries) {
        if (!returnParameter(key) || params.has(key) || !values[index])
          throw Error('Invalid return parameter');
        for (const value of values[index]) {
          size += 1 + new URLSearchParams([[key, value]]).toString().length;
          if (size > contributionUrlLimit) throw Error('Return frame too large');
          params.append(key, value);
        }
      }
      return { path, params };
    });
  } catch {
    return [];
  }
}
function trail(params: URLSearchParams): Frame[] {
  if (params.has('nav')) return decode(params.get('nav')!);
  // Existing preview bookmarks remain readable; new links never emit recursive returnTo.
  const frames: Frame[] = [];
  let parent = params.get('returnTo');
  while (parent && frames.length < frameLimit) {
    const next = frame(parent);
    if (!next) break;
    frames.push(next);
    const query = new URL(parent, origin).searchParams;
    if (query.has('nav')) return [...frames, ...decode(query.get('nav')!)].slice(0, frameLimit);
    parent = query.get('returnTo');
  }
  return frames;
}
function withTrail(href: string, frames: Frame[]): string | null {
  const url = new URL(href, origin);
  url.searchParams.delete('nav');
  url.searchParams.delete('returnTo');
  const retained = frames.slice(0, frameLimit);
  for (;;) {
    const encoded = retained.length ? encode(retained) : '';
    if (encoded !== null) {
      if (encoded) url.searchParams.set('nav', encoded);
      else url.searchParams.delete('nav');
      const result = url.pathname + url.search;
      if (contributionUrlFits(result)) return result;
    }
    // Retain the immediate parent exactly. Older trail entries are bounded;
    // native browser Back/Forward retains the full browsing history.
    if (retained.length <= 1) return null;
    retained.pop();
  }
}
export function withContributionReturn(href: string, parent?: string): string | null {
  if (parent && !contributionUrlFits(parent)) return null;
  const current = parent ? frame(parent) : null;
  return withTrail(href, current ? [current, ...trail(new URL(parent!, origin).searchParams)] : []);
}
export function contributionReturnHref(params: URLSearchParams, fallback: string): string {
  const [parent, ...rest] = trail(params);
  return parent
    ? (withTrail(parent.path + (parent.params.size ? '?' + parent.params.toString() : ''), rest) ??
        fallback)
    : fallback;
}
