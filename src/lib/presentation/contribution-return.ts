import { z } from 'zod';
import { safeReturnPath } from './navigation';
import { contributionScopeKeys } from './contribution-settings';

export const contributionUrlLimit = 7500;
export const contributionLinkLimitMessage =
  'This selection is too large for a detail link. Narrow the filters or search and try again.';
const frameLimit = 8;
const origin = 'https://dashboard.invalid';
type Frame = { path: string; params: URLSearchParams };
// Each parameter value is stored once across the trail. Frames are independent snapshots:
// changing the current filters never changes an ancestor's scope or presentation.
const trailSchema = z.tuple([
  z.literal(1),
  z.array(z.array(z.string().max(contributionUrlLimit)).min(1).max(512)).max(256),
  z
    .array(
      z.tuple([
        z.string().max(contributionUrlLimit),
        z.array(z.tuple([z.string().max(100), z.number().int().nonnegative()])).max(64),
      ]),
    )
    .max(frameLimit),
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
function encode(frames: Frame[]): string {
  const values: string[][] = [];
  const indices = new Map<string, number>();
  const packed = frames.map(({ path, params }) => [
    path,
    [...new Set(params.keys())].map((key) => {
      const value = params.getAll(key),
        identity = JSON.stringify(value);
      let index = indices.get(identity);
      if (index === undefined) {
        index = values.length;
        indices.set(identity, index);
        values.push(value);
      }
      return [key, index];
    }),
  ]);
  const bytes = new TextEncoder().encode(JSON.stringify([1, values, packed]));
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
    const [, values, frames] = trailSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
    return frames.map(([path, entries]) => {
      if (safeContributionReturn(path, '') !== path || path.includes('?') || path.includes('#'))
        throw Error('Invalid return path');
      const params = new URLSearchParams();
      for (const [key, index] of entries) {
        if (!returnParameter(key) || params.has(key) || !values[index])
          throw Error('Invalid return parameter');
        for (const value of values[index]) params.append(key, value);
      }
      if (!contributionUrlFits(path + '?' + params.toString()))
        throw Error('Return frame too large');
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
    if (retained.length) url.searchParams.set('nav', encode(retained));
    else url.searchParams.delete('nav');
    const result = url.pathname + url.search;
    if (contributionUrlFits(result)) return result;
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
