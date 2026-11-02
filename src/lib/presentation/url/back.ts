// Return context (P5d): `back=` frames. Each frame records only how a parent differs from the parent
// derived from its child, the way a URL records only how it differs from the v1 defaults.
//
//   value = "-"                derived: equals the parent derived from its child
//         / "!"                unavailable: the ancestor cannot be restored
//         / "~" pairs          same route as the derived parent; differences only
//         / path ["~" pairs]   another route; differences from its baseline
//   pair  = key ":" value / key (a bare flag) / "-" key (the parent lacks the key)
//
// Values and path segments escape every UTF-8 byte outside `A-Z a-z 0-9 - . _ , : @` as `*HH`, so a
// frame never holds `%` and one URL decode leaves it unchanged.
import { contributionUrlFits } from '../contribution-return';
import { canonicalRoutePath } from '../navigation';
import {
  parseQuery,
  queryPairs,
  sameQuery,
  serializeQuery,
  urlHref,
  type HrefOptions,
  type QueryPair,
} from './codec';
import {
  matchRoute,
  paramFor,
  routePath,
  screenOf,
  urlParams,
  type UrlRoute,
  type UrlSegments,
  type UrlValue,
  type UrlValues,
} from './registry';

/** One report view: a route, its decoded segments and its registry values. */
export interface UrlView {
  readonly route: UrlRoute;
  readonly segments: UrlSegments;
  readonly values: UrlValues;
}
export const backFrameLimit = 8;
/** The share of an href its `back` parameters may take. */
export const backBudget = 1000;
/** The whole-href cap, in bytes (the existing report URL limit). */
export const hrefLimit = 7500;
export const derivedFrame = '-';
export const unavailableFrame = '!';
/** Shown for a crumb whose ancestor cannot be restored. */
export const unavailableParentMessage = 'The page this link came from is not available.';

const plain = /^[A-Za-z0-9\-._,:@]$/;
/** Escape text for a frame: `*HH` per UTF-8 byte outside the plain set; null for a lone surrogate. */
export function escapeFrameText(text: string): string | null {
  try {
    encodeURIComponent(text);
  } catch {
    return null;
  }
  let result = '';
  for (const char of text)
    result += plain.test(char)
      ? char
      : Array.from(
          new TextEncoder().encode(char),
          (byte) => '*' + byte.toString(16).toUpperCase().padStart(2, '0'),
        ).join('');
  return result;
}
/** Undo `escapeFrameText`; null for malformed escapes or bytes that are not UTF-8. */
export function unescapeFrameText(text: string): string | null {
  if (!/^(?:[A-Za-z0-9\-._,:@]|\*[0-9A-F]{2})*$/.test(text)) return null;
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index++)
    if (text[index] === '*') {
      bytes.push(parseInt(text.slice(index + 1, index + 3), 16));
      index += 2;
    } else bytes.push(text.charCodeAt(index));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

const scopeKeys = ['sample', 'lens', 'period', 'repo', 'type', 'account', 'company', 'exclude'];
/** Fields a supporting view adds to its Timeline; the authors-list fields stay on an author's records. */
const supportFields = [
  'detail',
  'interval',
  'snap',
  'origin',
  'author',
  'dq',
  'dsort',
  'dpage',
  'dcols',
];
const listFields = ['listq', 'listsort', 'listpage'];
const pick = (values: UrlValues, names: readonly string[]) => {
  const result: Record<string, UrlValue> = {};
  for (const name of names) if (values[name] !== undefined) result[name] = values[name];
  return result;
};
const omit = (values: UrlValues, names: readonly string[]) => {
  const result: Record<string, UrlValue> = { ...values };
  for (const name of names) delete result[name];
  return result;
};

/**
 * How a view's parent is found.
 * - `top`: a top-level report; it has no parent.
 * - `none`: a parent exists only through a frame (the repository Timeline).
 * - `derived`: absent frames mean this parent.
 * - `inherit`: the parent is always this one, and it carries the child's frames.
 */
export type Derivation =
  | { kind: 'top' }
  | { kind: 'none' }
  | { kind: 'derived'; parent: UrlView }
  | { kind: 'inherit'; parent: UrlView };

/** The parent a view derives (section 4 of the P5d design). */
export function derive(view: UrlView): Derivation {
  const { route, segments, values } = view;
  const screen = screenOf(route, values);
  const scope = pick(values, scopeKeys);
  switch (screen) {
    case 'summary':
    case 'export':
      return { kind: 'top' };
    case 'matrix':
      return {
        kind: 'derived',
        parent: { route: '/repos', segments: {}, values: pick(values, ['repo']) },
      };
    case 'records':
    case 'insight':
      return { kind: 'derived', parent: { route: '/repos', segments: {}, values: {} } };
    case 'repositoryTimeline':
      return { kind: 'none' };
    case 'authorRecords':
      return {
        kind: 'inherit',
        parent: {
          route: '/repos/[slug]',
          segments: { slug: segments.slug },
          values: {
            ...pick(values, ['period', 'at', 'metric', 'back']),
            ...renamed(values, { listq: 'q', listsort: 'sort', listpage: 'page' }),
          },
        },
      };
    case 'support':
      return {
        kind: 'inherit',
        parent: {
          route,
          segments,
          values:
            values.author !== undefined
              ? omit(values, ['author', 'dq', 'dsort', 'dpage', 'dcols'])
              : omit(values, [...supportFields, ...listFields]),
        },
      };
    case 'contributionTimeline':
      return { kind: 'derived', parent: { route, segments, values: scope } };
    case 'contributionOverview':
      return values.metric === undefined
        ? { kind: 'top' }
        : { kind: 'derived', parent: { route, segments: {}, values: scope } };
    default:
      return { kind: 'derived', parent: contributionOverview(route, scope) };
  }
}
function renamed(values: UrlValues, names: Record<string, string>) {
  const result: Record<string, UrlValue> = {};
  for (const [from, to] of Object.entries(names))
    if (values[from] !== undefined) result[to] = values[from];
  return result;
}
/** A contribution subject's area overview at its scope, under its lens. */
function contributionOverview(route: UrlRoute, scope: Record<string, UrlValue>): UrlView {
  if (route === '/companies/[...identity]')
    return { route: '/companies', segments: {}, values: scope };
  const { lens, ...rest } = scope;
  return {
    route: lens === 'reviewers' ? '/reviewers' : '/contributors',
    segments: {},
    values: rest,
  };
}

const sameSegments = (a: UrlSegments, b: UrlSegments) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
/** Whether a parent may stand at a child's first position (the P5d parent graph). */
export function allowedParent(child: UrlView, parent: UrlView): boolean {
  const childScreen = screenOf(child.route, child.values);
  const parentScreen = screenOf(parent.route, parent.values);
  switch (childScreen) {
    case 'matrix':
    case 'records':
    case 'insight':
      return parentScreen === 'summary';
    case 'repositoryTimeline':
      return (
        parentScreen === 'matrix' ||
        (['records', 'insight', 'authorRecords'].includes(parentScreen) &&
          parent.segments.slug?.[0] === child.segments.slug?.[0])
      );
    case 'contributionTimeline':
      return (
        parent.route === child.route &&
        sameSegments(parent.segments, child.segments) &&
        parentScreen !== 'contributionTimeline' &&
        parentScreen !== 'support'
      );
    case 'contributionOverview':
    case 'contributionDetail':
      return ['contributionOverview', 'contributionDetail', 'contributionTimeline'].includes(
        parentScreen,
      );
    default:
      return false;
  }
}

/** A view's canonical pairs (decoded, defaults omitted), without return context or version. */
export function viewPairs(view: UrlView): QueryPair[] {
  return queryPairs(serializeQuery(view.route, omit(view.values, ['back', 'v'])));
}
function encodePairs(baseline: QueryPair[], target: QueryPair[]): string | null {
  const keys = [...new Set([...baseline, ...target].map(([key]) => key))];
  const parts: string[] = [];
  for (const key of keys) {
    const before = baseline.filter(([name]) => name === key).map(([, value]) => value);
    const after = target.filter(([name]) => name === key).map(([, value]) => value);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    if (!after.length) parts.push('-' + key);
    for (const value of after) {
      if (value === '' && !before.length && isFlag(key)) {
        parts.push(key);
        continue;
      }
      const escaped = escapeFrameText(value);
      if (escaped === null) return null;
      parts.push(key + ':' + escaped);
    }
  }
  return parts.join('~');
}
const flags: ReadonlySet<string> = new Set(
  urlParams.filter((entry) => entry.kind === 'flag').map((entry) => entry.name),
);
const isFlag = (key: string) => flags.has(key);
/** The baseline a frame for `parent`'s route diffs against, given the child's derivation. */
function baselineFor(derivation: Derivation, route: UrlRoute, segments: UrlSegments): UrlView {
  if (derivation.kind !== 'derived' && derivation.kind !== 'inherit')
    return { route, segments, values: {} };
  const derived = derivation.parent;
  if (derived.route === route && sameSegments(derived.segments, segments)) return derived;
  const screen = screenOf(route, {});
  const values: Record<string, UrlValue> = {};
  for (const [name, value] of Object.entries(derived.values))
    if (name !== 'back' && paramFor(route, screen, name)) values[name] = value;
  return { route, segments, values };
}
function samePath(a: UrlView, b: UrlView) {
  return a.route === b.route && sameSegments(a.segments, b.segments);
}
/**
 * The frame that restores `parent` from `child`: `-` when the parent is the derived one, `~pairs`
 * for a derived route with other values, or the parent's path and its differences. Null when a
 * value cannot be written (a lone surrogate).
 */
export function encodeFrame(child: UrlView, parent: UrlView): string | null {
  try {
    return frameFor(child, parent);
  } catch {
    // A segment that is not well-formed text cannot be written.
    return null;
  }
}
function frameFor(child: UrlView, parent: UrlView): string | null {
  const derivation = derive(child);
  const derived = derivation.kind === 'derived' ? derivation.parent : undefined;
  const target = viewPairs(parent);
  if (derived && samePath(derived, parent)) {
    const pairs = encodePairs(viewPairs(derived), target);
    return pairs === null ? null : pairs ? '~' + pairs : derivedFrame;
  }
  const path = routePath(parent.route, parent.segments)
    .split('/')
    .slice(1)
    .map((segment) => escapeFrameText(decodeURIComponent(segment)));
  if (path.includes(null)) return null;
  const pairs = encodePairs(
    viewPairs(baselineFor(derivation, parent.route, parent.segments)),
    target,
  );
  return pairs === null ? null : '/' + path.join('/') + (pairs ? '~' + pairs : '');
}
/** The ancestor a frame names for a child, or null when the frame cannot be resolved there. */
export function decodeFrame(child: UrlView, frame: string): UrlView | null {
  const derivation = derive(child);
  let base: UrlView;
  let rest: string;
  if (frame.startsWith('/')) {
    const split = frame.indexOf('~');
    const rawPath = split < 0 ? frame : frame.slice(0, split);
    rest = split < 0 ? '' : frame.slice(split + 1);
    const segments = rawPath.slice(1).split('/').map(unescapeFrameText);
    if (segments.includes(null)) return null;
    const matched = matchRoute('/' + (segments as string[]).map(encodeURIComponent).join('/'));
    if (!matched) return null;
    base = baselineFor(derivation, matched.route, matched.segments);
  } else if (frame.startsWith('~') && derivation.kind === 'derived') {
    base = derivation.parent;
    rest = frame.slice(1);
  } else return null;
  // `~` always introduces at least one pair.
  if (!rest && frame.includes('~')) return null;
  const pairs = applyPairs(viewPairs(base), rest);
  if (!pairs) return null;
  const parsed = parseQuery(base.route, pairs);
  if (parsed.kind !== 'canonical') return null;
  const parent = { route: base.route, segments: base.segments, values: parsed.values };
  return allowedParent(child, parent) ? parent : null;
}
function applyPairs(baseline: QueryPair[], text: string): QueryPair[] | null {
  if (!text) return baseline;
  let pairs = [...baseline];
  const replaced = new Set<string>();
  for (const part of text.split('~')) {
    const match = /^(-?)([A-Za-z][A-Za-z0-9.]*)(?::(.*))?$/.exec(part);
    if (!match) return null;
    const [, remove, key, raw] = match;
    if (remove) {
      if (raw !== undefined) return null;
      pairs = pairs.filter(([name]) => name !== key);
      continue;
    }
    const value = raw === undefined ? '' : unescapeFrameText(raw);
    if (value === null) return null;
    if (!replaced.has(key)) {
      pairs = pairs.filter(([name]) => name !== key);
      replaced.add(key);
    }
    pairs.push([key, value]);
  }
  return pairs;
}

/** One ancestor of a view: restorable, with its href, or unavailable. */
export type Ancestor =
  | { readonly available: true; readonly view: UrlView; readonly href: string }
  | { readonly available: false };
/** The `back` frames a view carries. */
export function backFrames(values: UrlValues): string[] {
  const back = values.back;
  return typeof back === 'object' ? [...back] : [];
}
/**
 * Every ancestor of a view, nearest first, from its derivation and frames. An unresolvable frame
 * makes that ancestor and every farther one unavailable; nothing broader replaces it.
 */
export function resolveBack(view: UrlView): Ancestor[] {
  const frames = backFrames(view.values);
  const ancestors: Ancestor[] = [];
  let current: UrlView = { ...view, values: omit(view.values, ['back']) };
  for (let step = 0; step <= backFrameLimit * 2; step++) {
    const derivation = derive(current);
    if (derivation.kind === 'top') {
      if (frames.length) ancestors.push({ available: false });
      break;
    }
    let parent: UrlView | null;
    if (derivation.kind === 'inherit')
      parent = { ...derivation.parent, values: omit(derivation.parent.values, ['back']) };
    else {
      const frame = frames.shift();
      if (frame === undefined && derivation.kind === 'none') break;
      parent =
        frame === undefined || frame === derivedFrame
          ? derivation.kind === 'derived'
            ? derivation.parent
            : null
          : decodeFrame(current, frame);
    }
    if (!parent) {
      ancestors.push({ available: false });
      break;
    }
    const href = viewHref({ ...parent, values: { ...parent.values, back: frames } }, 'back', {
      explicit: true,
    });
    ancestors.push(href === null ? { available: false } : { available: true, view: parent, href });
    if (href === null) break;
    current = parent;
  }
  return ancestors;
}

export type BackMode = 'child' | 'back' | 'level';
/**
 * Append `back` frames to an href within the budget. At most 8 frames; their `&back=` parameters
 * take at most 1,000 characters and the whole href at most 7,500 bytes. Farther frames are dropped
 * first, then trailing `-` frames.
 * - `child`: a link one level down; the first frame is never dropped, and the link is refused
 *   (null) when it cannot fit.
 * - `back`: a link to an ancestor; every frame may be dropped.
 * - `level`: the page's own address (an edit, a tab, a legacy 307); the first frame is exempt from
 *   the 1,000 budget but not the 7,500 cap, and is never dropped.
 */
export function withBack(base: string, frames: readonly string[], mode: BackMode): string | null {
  const kept = fitBack(base, frames, mode);
  return kept && appendBack(base, kept);
}
function appendBack(base: string, frames: readonly string[]): string {
  if (!frames.length) return base;
  const hash = base.indexOf('#');
  const [href, fragment] = hash < 0 ? [base, ''] : [base.slice(0, hash), base.slice(hash)];
  return (
    href +
    (href.includes('?') ? '&' : '?') +
    frames.map((frame) => 'back=' + frame).join('&') +
    fragment
  );
}
/** The frames `withBack` keeps for a base href, or null when the link is refused. */
export function fitBack(base: string, frames: readonly string[], mode: BackMode): string[] | null {
  const trim = (list: string[]) => {
    while (list.length && list[list.length - 1] === derivedFrame) list.pop();
    return list;
  };
  const kept = trim(frames.slice(0, backFrameLimit));
  // The immediate parent is never partially reconstructed: in `child` and `level` it stays whole.
  const pinned = mode !== 'back' && kept.length ? 1 : 0;
  for (;;) {
    const budgeted = kept.slice(mode === 'level' ? 1 : 0);
    const share = budgeted.reduce((sum, frame) => sum + '&back='.length + frame.length, 0);
    if (share <= backBudget && contributionUrlFits(appendBack(base, kept))) return kept;
    if (kept.length <= pinned) return null;
    kept.pop();
    trim(kept);
  }
}
/**
 * A view's canonical href with its `back` frames within the budget for a mode; null when the mode
 * refuses it. Frames are written in registry order, so the result parses back to itself.
 */
export function viewHref(view: UrlView, mode: BackMode, options: HrefOptions = {}): string | null {
  const rest = omit(view.values, ['back']);
  const kept = fitBack(
    urlHref(view.route, view.segments, rest, options),
    backFrames(view.values),
    mode,
  );
  return (
    kept &&
    urlHref(view.route, view.segments, kept.length ? { ...rest, back: kept } : rest, options)
  );
}
/** The report view a same-origin canonical href shows, or null for any other href. */
export function viewOf(href: string): UrlView | null {
  let url: URL;
  try {
    url = new URL(href, 'https://dashboard.invalid');
  } catch {
    return null;
  }
  const matched = url.origin === 'https://dashboard.invalid' ? matchRoute(url.pathname) : null;
  if (!matched || !href.startsWith('/')) return null;
  const parsed = parseQuery(matched.route, url.search);
  return parsed.kind === 'canonical' ? { ...matched, values: parsed.values } : null;
}
/** Whether two hrefs show the same view, ignoring return context, version and fragment. */
export function sameView(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const parse = (href: string) => {
    const url = new URL(href, 'https://dashboard.invalid');
    const pairs = queryPairs(url.search).filter(([key]) => key !== 'back' && key !== 'v');
    return { path: canonicalRoutePath(url.pathname), pairs, origin: url.origin };
  };
  const left = parse(a),
    right = parse(b);
  return (
    left.origin === right.origin && left.path === right.path && sameQuery(left.pairs, right.pairs)
  );
}
/**
 * The frames a view's next state carries, so a child edit never moves its resolved parent: the
 * first frame is rewritten against the new state's derivation, farther frames are unchanged. A
 * view whose parent is inherited or unavailable keeps its frames.
 */
export function rebaseBack(previous: UrlView, next: UrlView): string[] {
  const frames = backFrames(previous.values);
  const derivation = derive(previous);
  if (derivation.kind === 'top' || derivation.kind === 'inherit') return frames;
  const [parent] = resolveBack(previous);
  if (!parent) return frames;
  if (!parent.available) return [unavailableFrame, ...frames.slice(1)];
  const frame = encodeFrame({ ...next, values: omit(next.values, ['back']) }, parent.view);
  if (frame === null) return frames;
  return [frame, ...frames.slice(1)];
}
const withoutBack = (view: UrlView): UrlView => ({
  ...view,
  values: omit(view.values, ['back']),
});
/**
 * A link one level down from `parent`: the child's canonical href with the parent as its first
 * `back` frame and the parent's own frames after it. Null when the parent frame cannot fit, so the
 * link is disabled with the existing limit message.
 */
export function childViewHref(parent: UrlView, child: UrlView): string | null {
  const own = withoutBack(child);
  const frame = encodeFrame(own, withoutBack(parent));
  if (frame === null) return null;
  return viewHref(
    { ...own, values: { ...own.values, back: [frame, ...backFrames(parent.values)] } },
    'child',
  );
}
/**
 * The same page with other values (a same-level tab or an edit): the parent it resolves to is
 * kept by rebasing its frames. Null when the address would exceed the URL cap.
 */
export function levelViewHref(current: UrlView, next: UrlView): string | null {
  const own = withoutBack(next);
  return viewHref({ ...own, values: { ...own.values, back: rebaseBack(current, own) } }, 'level');
}
