// The frozen contribution return trail reader (decision 12): old links carried their parents as a
// base64 `nav` trail or a recursive `returnTo`. Links no longer write them; this reader decodes
// them so the page helper can answer an old link with a 307 to its `back` frames.
import { z } from 'zod';
import { safeReturnPath } from '../../navigation';
import { contributionScopeKeys } from './contribution';
import { timelineViewKeys } from '@/models/timeline-controls';
import { contributionUrlFits, contributionUrlLimit } from '../../contribution-return';

const frameLimit = 8;
const valueLimit = 512;
const poolLimit = 256;
// Bound materialized UTF-16 units before expanding compact values. Each restored
// frame is also checked against the stricter encoded URL byte budget before append.
const expansionLimit = frameLimit * contributionUrlLimit;
const origin = 'https://dashboard.invalid';
export type TrailFrame = { path: string; params: URLSearchParams };
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
  'timeline',
  'timeline.gap',
  ...timelineViewKeys,
]);
function returnParameter(key: string): boolean {
  return (
    scopeKeys.has(key) ||
    /^(report|contributors|companies|members|repositories|details)\.(q|sort|dir|page|columns)$/.test(
      key,
    )
  );
}
/** A contribution report path an old trail may name, or `fallback`. */
export function safeContributionReturn(value: string | null | undefined, fallback: string): string {
  if (!value || !contributionUrlFits(value)) return fallback;
  const path = safeReturnPath(value);
  return contributionUrlFits(path) && /^\/(contributors|companies)(?:[/?#]|$)/.test(path)
    ? path
    : fallback;
}
function frame(href: string): TrailFrame | null {
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
function decode(raw: string): TrailFrame[] {
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
/** Every frame an old link's `nav` trail or recursive `returnTo` names, nearest first. */
export function trail(params: URLSearchParams): TrailFrame[] {
  if (params.has('nav')) return decode(params.get('nav')!);
  // Existing preview bookmarks remain readable; new links never emit recursive returnTo.
  const frames: TrailFrame[] = [];
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
