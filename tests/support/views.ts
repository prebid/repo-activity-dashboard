// The one list of report views and sign-in pages that capture, title and layout checks read.
// It has no imports so Playwright, Vitest and Node's type stripping can all load it.
export type ViewAccess = 'signed-in' | 'signed-out' | 'public';
/**
 * The checks and measurements a view feeds. `type-sample` is the sign-in page and the eleven
 * views the 2026-10-31 review counted rendered type pairs over.
 */
export type ViewUse =
  'visual-review' | 'reflow' | 'layout-width' | 'activity-region' | 'type-sample';
export interface InventoryView {
  /** Stable kebab-case name: screenshot stem and test-title suffix. */
  readonly id: string;
  /** Requested pathname and query, without origin. */
  readonly path: string;
  readonly access: ViewAccess;
  /** Views of one page share a document title; different pages never do. */
  readonly page: string;
  readonly uses: readonly ViewUse[];
}

// A period pinned to the samples' snapshot, as the Summary's drilldown links write it.
const thisMonth = 'period=this-month&at=2026-10-24T12:00Z';
const thisYear = 'period=this-year&at=2026-10-24T12:00Z';

export const signInPages = [
  {
    id: 'sign-in',
    path: '/auth/login',
    access: 'signed-out',
    page: 'sign-in',
    uses: ['type-sample'],
  },
  { id: 'sign-in-error', path: '/auth/error', access: 'public', page: 'sign-in-error', uses: [] },
  { id: 'account-setup', path: '/auth/setup', access: 'public', page: 'account-setup', uses: [] },
  {
    id: 'change-password',
    path: '/auth/change-password',
    access: 'signed-in',
    page: 'change-password',
    uses: [],
  },
] as const satisfies readonly InventoryView[];

export const reportViews = [
  {
    id: 'repos-overview',
    path: '/repos',
    access: 'signed-in',
    page: 'repos-summary',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'repos-comparison',
    path: '/repos?repo=prebidjs,prebidserver&period2=last-month&age=30,60,90',
    access: 'signed-in',
    page: 'repos-summary',
    uses: ['visual-review', 'reflow', 'activity-region'],
  },
  {
    id: 'repos-timeline',
    path: '/repos?timeline',
    access: 'signed-in',
    page: 'repos-timeline',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'repos-timeline-week-state',
    path: '/repos?timeline&repo=prebidserver&group=week',
    access: 'signed-in',
    page: 'repos-timeline',
    uses: [],
  },
  {
    id: 'repos-timeline-mixed-quarter',
    path: '/repos?timeline&sample=mixed&group=quarter',
    access: 'signed-in',
    page: 'repos-timeline',
    uses: [],
  },
  {
    id: 'repo-detail',
    path: '/repos/prebidjs',
    access: 'signed-in',
    page: 'repo-prs',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'repo-issues-tab',
    path: '/repos/prebidjs?view=issues',
    access: 'signed-in',
    page: 'repo-issues',
    uses: [],
  },
  {
    id: 'repo-open-issues-metric',
    // The Summary's open-issues link is the Issues tab; the pinned form keeps the two rows apart.
    path: '/repos/prebidjs?view=issues&v=1',
    access: 'signed-in',
    page: 'repo-issues',
    uses: ['layout-width'],
  },
  {
    id: 'repo-docs-open-issues',
    path: '/repos/prebiddocs?view=issues',
    access: 'signed-in',
    page: 'repo-docs-open-issues',
    uses: ['visual-review'],
  },
  {
    id: 'repo-approvals-metric',
    path: '/repos/prebidjs?metric=humanApprovals0',
    access: 'signed-in',
    page: 'repo-approvals',
    uses: ['visual-review'],
  },
  {
    id: 'repo-authors-metric',
    path: '/repos/prebidjs?' + thisMonth + '&metric=prAuthors',
    access: 'signed-in',
    page: 'repo-authors',
    uses: ['visual-review', 'reflow', 'type-sample'],
  },
  {
    id: 'repo-credits-metric',
    path: '/repos/prebidjs?' + thisMonth + '&metric=agentFeedbackCredits',
    access: 'signed-in',
    page: 'repo-credits',
    uses: ['visual-review'],
  },
  {
    id: 'repo-duration-metric',
    path: '/repos/prebidjs?' + thisMonth + '&metric=medianMergeDays',
    access: 'signed-in',
    page: 'repo-durations',
    uses: ['visual-review', 'reflow'],
  },
  {
    id: 'repo-timeline',
    path: '/repos/prebidjs?timeline',
    access: 'signed-in',
    page: 'repo-timeline',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'repo-timeline-issues-week',
    path: '/repos/prebidjs?timeline&view=issues&group=week',
    access: 'signed-in',
    page: 'repo-timeline',
    uses: [],
  },
  {
    id: 'repo-author',
    path: '/repos/prebidjs/authors/sample-author-2?' + thisYear + '&metric=prAuthors',
    access: 'signed-in',
    page: 'repo-author-prs',
    uses: ['visual-review', 'layout-width', 'type-sample'],
  },
  {
    id: 'repo-author-issues',
    path: '/repos/prebidjs/authors/sample-author-2?' + thisYear + '&metric=issueAuthors',
    access: 'signed-in',
    page: 'repo-author-issues',
    uses: ['visual-review'],
  },
  {
    id: 'contributors',
    path: '/contributors',
    access: 'signed-in',
    page: 'contributors',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'contributors-report',
    path: '/contributors?v=1',
    access: 'signed-in',
    page: 'contributors',
    uses: [],
  },
  {
    id: 'contributors-timeline',
    path: '/contributors?timeline',
    access: 'signed-in',
    page: 'contributors-timeline',
    uses: ['layout-width'],
  },
  {
    id: 'contributors-timeline-empty',
    path: '/contributors?timeline&sample=empty',
    access: 'signed-in',
    page: 'contributors-timeline',
    uses: [],
  },
  {
    id: 'contributors-timeline-missing',
    path: '/contributors?timeline&sample=missing',
    access: 'signed-in',
    page: 'contributors-timeline',
    uses: [],
  },
  {
    id: 'contributor-detail',
    path: '/contributors/account-alice',
    access: 'signed-in',
    page: 'contributor',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'contributor-detail-timeline',
    path: '/contributors/account-alice?timeline',
    access: 'signed-in',
    page: 'contributor-timeline',
    uses: ['layout-width'],
  },
  {
    id: 'companies',
    path: '/companies',
    access: 'signed-in',
    page: 'companies',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'companies-timeline',
    path: '/companies?timeline',
    access: 'signed-in',
    page: 'companies-timeline',
    uses: ['layout-width'],
  },
  {
    id: 'company-detail',
    path: '/companies/id/company-acme',
    access: 'signed-in',
    page: 'company',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'company-repositories',
    path: '/companies/id/company-acme?view=repositories',
    access: 'signed-in',
    page: 'company-repositories',
    uses: ['layout-width'],
  },
  {
    id: 'company-timeline',
    path: '/companies/id/company-acme?timeline',
    access: 'signed-in',
    page: 'company-timeline',
    uses: ['layout-width'],
  },
  {
    id: 'reviewers',
    path: '/reviewers',
    access: 'signed-in',
    page: 'reviewers',
    uses: ['layout-width'],
  },
  {
    id: 'reviewers-large',
    path: '/reviewers?sample=large',
    access: 'signed-in',
    page: 'reviewers',
    uses: ['visual-review'],
  },
  {
    id: 'reviewers-timeline',
    path: '/reviewers?timeline',
    access: 'signed-in',
    page: 'reviewers-timeline',
    uses: ['layout-width'],
  },
  {
    id: 'companies-reviewers',
    path: '/companies?lens=reviewers',
    access: 'signed-in',
    page: 'companies-reviewers',
    uses: ['layout-width'],
  },
  {
    id: 'contributor-detail-reviewers',
    path: '/contributors/account-alice?lens=reviewers',
    access: 'signed-in',
    page: 'contributor-reviewers',
    uses: ['layout-width', 'visual-review'],
  },
  {
    id: 'contributor-no-reviewer-activity',
    path: '/contributors/account-finn?lens=reviewers',
    access: 'signed-in',
    page: 'contributor-no-reviewer-activity',
    uses: ['visual-review'],
  },
  {
    id: 'company-detail-reviewers',
    path: '/companies/id/company-acme?lens=reviewers',
    access: 'signed-in',
    page: 'company-reviewers',
    uses: ['layout-width'],
  },
  {
    id: 'companies-all',
    path: '/companies?lens=all',
    access: 'signed-in',
    page: 'companies-all',
    uses: ['layout-width'],
  },
  {
    id: 'companies-timeline-all',
    path: '/companies?timeline&lens=all',
    access: 'signed-in',
    page: 'companies-timeline-all',
    uses: ['layout-width'],
  },
  {
    id: 'company-detail-all',
    path: '/companies/id/company-acme?lens=all',
    access: 'signed-in',
    page: 'company-all',
    uses: ['layout-width'],
  },
  {
    id: 'contributor-detail-all',
    path: '/contributors/account-alice?lens=all',
    access: 'signed-in',
    page: 'contributor-all',
    uses: ['layout-width', 'visual-review'],
  },
  {
    id: 'foundation',
    path: '/foundation',
    access: 'signed-in',
    page: 'foundation',
    uses: ['type-sample'],
  },
] as const satisfies readonly InventoryView[];

export const inventory: readonly InventoryView[] = [...signInPages, ...reportViews];
export type InventoryId = (typeof signInPages)[number]['id'] | (typeof reportViews)[number]['id'];

export function viewsFor(use: ViewUse): readonly InventoryView[] {
  const views = inventory.filter((view) => view.uses.includes(use));
  if (!views.length) throw new Error('No inventory views are marked for ' + use);
  return views;
}
