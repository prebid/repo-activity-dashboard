// The retired base64 `nav` trail writer, kept as a test fixture generator: tests build the old
// links that the legacy decoder must still answer with a 307. The product only reads trails
// (src/lib/presentation/url/legacy/trail.ts).
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import {
  safeContributionReturn,
  trail,
  type TrailFrame,
} from '@/lib/presentation/url/legacy/trail';

export { safeContributionReturn, trail };
const frameLimit = 8;
const valueLimit = 512;
const poolLimit = 256;
const origin = 'https://dashboard.invalid';
type PackedValues = string[] | { p: string; w: number; s: string };

function frame(href: string): TrailFrame | null {
  const safe = safeContributionReturn(href, '');
  if (!safe) return null;
  const [first] = trail(new URLSearchParams({ returnTo: safe }));
  return first ?? null;
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
/** A version 2 trail as the old links wrote it. */
export function encodeTrail(frames: readonly TrailFrame[]): string | null {
  const values: string[][] = [];
  const indices = new Map<string, number>();
  const packed: [string, [string, number][]][] = [];
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
function withTrail(href: string, frames: TrailFrame[]): string | null {
  const url = new URL(href, origin);
  url.searchParams.delete('nav');
  url.searchParams.delete('returnTo');
  const retained = frames.slice(0, frameLimit);
  for (;;) {
    const encoded = retained.length ? encodeTrail(retained) : '';
    if (encoded !== null) {
      if (encoded) url.searchParams.set('nav', encoded);
      else url.searchParams.delete('nav');
      const result = url.pathname + url.search;
      if (contributionUrlFits(result)) return result;
    }
    if (retained.length <= 1) return null;
    retained.pop();
  }
}
/** An old link to `href` that carried `parent` and its trail. */
export function withContributionReturn(href: string, parent?: string): string | null {
  if (parent && !contributionUrlFits(parent)) return null;
  const current = parent ? frame(parent) : null;
  return withTrail(href, current ? [current, ...trail(new URL(parent!, origin).searchParams)] : []);
}
/** The parent an old link's trail named, with the rest of its trail, or `fallback`. */
export function contributionReturnHref(params: URLSearchParams, fallback: string): string {
  const [parent, ...rest] = trail(params);
  return parent
    ? (withTrail(parent.path + (parent.params.size ? '?' + parent.params.toString() : ''), rest) ??
        fallback)
    : fallback;
}
