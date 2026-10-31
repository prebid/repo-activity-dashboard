import 'server-only';
import { safeReturnPath } from '@/lib/presentation/navigation';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import {
  contributionTimelinePreview,
  repositoryTimelinePreview,
  repositoryTimelineMatrixPreview,
} from './timeline-preview';
import { companyFocus } from '@/lib/presentation/contribution-navigation';
/** One authorized report loader for downloads and supporting views; only known dashboard routes. */
export async function loadTimelineReport(href: string) {
  if (safeReturnPath(href) !== href || !contributionUrlFits(href))
    return { status: 'invalid' as const };
  const url = new URL(href, 'https://dashboard.invalid');
  let parts: string[];
  try {
    parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { status: 'invalid' as const };
  }
  if (url.pathname === '/repos')
    return {
      ...(await repositoryTimelineMatrixPreview(url.searchParams)),
      category: 'matrix' as const,
    };
  if (parts[0] === 'repos' && parts.length === 2)
    return {
      ...(await repositoryTimelinePreview(parts[1], url.searchParams)),
      category: 'repository' as const,
    };
  if (parts[0] === 'contributors' && (parts.length === 1 || parts.length === 2))
    return {
      ...(await contributionTimelinePreview(
        'contributors',
        url.searchParams,
        parts.length === 2 ? { kind: 'contributor', accountId: parts[1] } : undefined,
      )),
      category: 'contribution' as const,
    };
  if (parts[0] === 'companies') {
    const focus = parts.length === 1 ? undefined : companyFocus(parts.slice(1));
    if (focus !== null)
      return {
        ...(await contributionTimelinePreview('companies', url.searchParams, focus)),
        category: 'contribution' as const,
      };
  }
  return { status: 'invalid' as const };
}
