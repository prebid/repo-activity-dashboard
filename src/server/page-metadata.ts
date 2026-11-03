import 'server-only';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getViewer } from '@/lib/auth/viewer';
import { contributionRecords } from './activity-contributions';
import { repositoryRecords } from './activity-database';
import { readContributionLayoutQuery } from '@/lib/presentation/contribution-navigation';
import {
  contributionPageTitle,
  repositoriesPageTitle,
  repositoryAuthorPageTitle,
  repositoryPageTitle,
} from '@/lib/presentation/page-title';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import type { ContributionLens } from '@/models/contribution-lens';
import type { OverviewRepository } from '@/models/repository-overview';
import { catalogRepository } from './reporting';

// Metadata renders into redirect bodies, so only a viewer who may see the page gets its title.
// A redirect renders metadata again outside getViewer's cache; one request store backs both.
const titlesAllowed = new WeakMap<object, Promise<boolean>>();
function allowsTitles(request: object): Promise<boolean> {
  let allowed = titlesAllowed.get(request);
  if (!allowed) {
    allowed = getViewer().then(
      (decision) => decision.kind === 'authenticated' && !decision.user.mustChangePassword,
    );
    titlesAllowed.set(request, allowed);
  }
  return allowed;
}
async function titled(title: () => string | null): Promise<Metadata> {
  if (!(await allowsTitles(await headers()))) return {};
  const value = title();
  return value === null ? {} : { title: value };
}
function forRepository(slug: string, title: (repository: OverviewRepository) => string) {
  return titled(() => {
    const found = catalogRepository(slug);
    return found ? title(found.identity) : null;
  });
}

export function repositoriesPageMetadata(params: URLSearchParams): Promise<Metadata> {
  return titled(() => repositoriesPageTitle(params));
}
export function repositoryPageMetadata(slug: string, params: URLSearchParams): Promise<Metadata> {
  return forRepository(slug, (repository) =>
    repositoryPageTitle(repository, params, repositoryRecords().asOf),
  );
}
export function repositoryAuthorPageMetadata(
  slug: string,
  account: string,
  params: URLSearchParams,
): Promise<Metadata> {
  return forRepository(slug, (repository) =>
    repositoryAuthorPageTitle(repository, account, params, repositoryRecords().asOf),
  );
}
/**
 * Subject names come from the URL's sample directory, as the report resolves them. `lens` names the
 * Reviewers lens of /reviewers, whose route is the lens; elsewhere the query's `lens` decides.
 */
export function contributionPageMetadata(
  area: ContributionArea,
  params: URLSearchParams,
  focus: ContributionFocus | null = { kind: 'overview' },
  lens?: ContributionLens,
): Promise<Metadata> {
  return titled(() => {
    if (focus === null) return null;
    if (focus.kind === 'overview') return contributionPageTitle(area, 'overview', params, lens);
    const layout = readContributionLayoutQuery(params);
    if (!layout) return null;
    const directory = contributionRecords().directory(layout.sample);
    const subject =
      focus.kind === 'contributor'
        ? directory.accounts.find((account) => account.id === focus.accountId)
        : focus.companyId === null
          ? null
          : directory.companies.find((company) => company.id === focus.companyId);
    return subject === undefined ? null : contributionPageTitle(area, subject, params, lens);
  });
}
