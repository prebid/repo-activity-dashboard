// Legacy return context (`returnTo`, `summary`, `timelineParent`, `nav`) as `back` frames: the
// frozen readers give each ancestor's absolute legacy href, nearest first, and each is decoded and
// written as a diff frame against the parent derived from the view below it.
import { overviewReturnPathSchema } from '@/models/repository-drilldown';
import { trail } from '../../contribution-return';
import { allowedParent, derive, encodeFrame, unavailableFrame, type UrlView } from '../back';
import { repositoryMatrixSummaryHref } from './overview';
import { safeTimelineParent, timelineParentQuery } from './timeline';

/** The query keys that carried return context before `back`. */
export const legacyTrailKeys = ['returnTo', 'summary', 'timelineParent', 'nav'] as const;
const origin = 'https://dashboard.invalid';
/** Decodes an ancestor's legacy href (without its trail keys) into a view. */
export type DecodeAncestor = (href: string) => UrlView | null;

/** A legacy ancestor href, or null when its trail key is present but names nothing restorable. */
type LegacyAncestor = string | null;

/** The repository-area chain a legacy href's own trail key names. */
function repositoryChain(href: string): LegacyAncestor[] {
  const url = new URL(href, origin);
  const params = url.searchParams;
  if (url.pathname === '/repos') {
    if (!params.has('timeline') || !params.has('summary')) return [];
    const summary = repositoryMatrixSummaryHref(params.get('summary'));
    return [summary];
  }
  if (params.has('timeline') && !params.has('timeline.detail')) {
    if (!params.has('timelineParent')) return [];
    const parent = safeTimelineParent(params.get('timelineParent'), url.pathname);
    return parent ? [parent, ...repositoryChain(parent)] : [null];
  }
  if (params.has('timeline'))
    return repositoryChain(url.pathname + '?' + timelineParentQuery(params).toString());
  const returnTo = params.get('returnTo');
  if (returnTo === null) return [];
  return overviewReturnPathSchema.safeParse(returnTo).success ? [returnTo] : [null];
}
/** The contribution-area chain: the decoded `nav` trail or the old recursive `returnTo`. */
function contributionChain(href: string): LegacyAncestor[] {
  const params = new URL(href, origin).searchParams;
  const source = params.has('timeline.detail') ? timelineParentQuery(params) : params;
  if (!source.has('nav') && !source.has('returnTo')) return [];
  const frames = trail(source);
  if (!frames.length) return [null];
  return frames.map(({ path, params: query }) => path + (query.size ? '?' + query.toString() : ''));
}
/**
 * The `back` frames that restore a legacy href's return context for its decoded view. A trail
 * key that decodes to nothing, or an ancestor that cannot stand at its position, becomes `!` there
 * (P5d decision: the page renders and that crumb is unavailable).
 */
export function legacyBackFrames(self: UrlView, href: string, decode: DecodeAncestor): string[] {
  const pathname = new URL(href, origin).pathname;
  const chain = pathname.startsWith('/repos') ? repositoryChain(href) : contributionChain(href);
  const frames: string[] = [];
  let current = self;
  for (const ancestor of chain) {
    let derivation = derive(current);
    while (derivation.kind === 'inherit') {
      current = derivation.parent;
      derivation = derive(current);
    }
    if (derivation.kind === 'top') break;
    const parent = ancestor === null ? null : decode(ancestor);
    const frame = parent && allowedParent(current, parent) ? encodeFrame(current, parent) : null;
    if (frame === null) {
      frames.push(unavailableFrame);
      break;
    }
    frames.push(frame);
    current = parent!;
  }
  return frames;
}
