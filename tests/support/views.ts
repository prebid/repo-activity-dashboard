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

const octoberRange =
  'from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-24T12%3A00%3A00.000Z&inclusive=1';
const yearRange = 'from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1';

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
    path: '/repos?repo=repo-prebidjs&repo=repo-prebidserver&period=this-month&period2=last-month&age=30&age=60&age=90',
    access: 'signed-in',
    page: 'repos-summary',
    uses: ['visual-review', 'reflow', 'activity-region'],
  },
  {
    id: 'repos-timeline',
    path: '/repos?timeline=1',
    access: 'signed-in',
    page: 'repos-timeline',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'repos-timeline-week-state',
    path: '/repos?timeline=1&timeline.state=1&timeline.group=week&repo=repo-prebidserver',
    access: 'signed-in',
    page: 'repos-timeline',
    uses: [],
  },
  {
    id: 'repos-timeline-mixed-quarter',
    path: '/repos?timeline=1&sample=mixed&timeline.group=quarter',
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
    path: '/repos/prebidjs?scope=current&metric=openIssues',
    access: 'signed-in',
    page: 'repo-issues',
    uses: ['layout-width'],
  },
  {
    id: 'repo-docs-open-issues',
    path: '/repos/prebiddocs?scope=current&metric=openIssues',
    access: 'signed-in',
    page: 'repo-docs-open-issues',
    uses: ['visual-review'],
  },
  {
    id: 'repo-approvals-metric',
    path: '/repos/prebidjs?scope=current&metric=humanApprovals0',
    access: 'signed-in',
    page: 'repo-approvals',
    uses: ['visual-review'],
  },
  {
    id: 'repo-authors-metric',
    path: '/repos/prebidjs?scope=period&metric=prAuthors&' + octoberRange,
    access: 'signed-in',
    page: 'repo-authors',
    uses: ['visual-review', 'reflow', 'type-sample'],
  },
  {
    id: 'repo-credits-metric',
    path: '/repos/prebidjs?scope=period&metric=agentFeedbackCredits&' + octoberRange,
    access: 'signed-in',
    page: 'repo-credits',
    uses: ['visual-review'],
  },
  {
    id: 'repo-duration-metric',
    path: '/repos/prebidjs?scope=period&metric=medianMergeDays&branch=master&' + octoberRange,
    access: 'signed-in',
    page: 'repo-durations',
    uses: ['visual-review', 'reflow'],
  },
  {
    id: 'repo-timeline',
    path: '/repos/prebidjs?timeline=1',
    access: 'signed-in',
    page: 'repo-timeline',
    uses: ['layout-width', 'type-sample'],
  },
  {
    id: 'repo-timeline-issues-week',
    path: '/repos/prebidjs?timeline=1&timeline.kind=issues&timeline.group=week',
    access: 'signed-in',
    page: 'repo-timeline',
    uses: [],
  },
  {
    id: 'repo-author',
    path: '/repos/prebidjs/authors/sample-author-2?scope=period&metric=prAuthors&' + yearRange,
    access: 'signed-in',
    page: 'repo-author-prs',
    uses: ['visual-review', 'layout-width', 'type-sample'],
  },
  {
    id: 'repo-author-issues',
    path: '/repos/prebidjs/authors/sample-author-2?scope=period&metric=issueAuthors&' + yearRange,
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
    path: '/contributors?scope=1&period=this-year',
    access: 'signed-in',
    page: 'contributors',
    uses: [],
  },
  {
    id: 'contributors-timeline',
    path: '/contributors?timeline=1',
    access: 'signed-in',
    page: 'contributors-timeline',
    uses: ['layout-width'],
  },
  {
    id: 'contributors-timeline-empty',
    path: '/contributors?timeline=1&sample=empty',
    access: 'signed-in',
    page: 'contributors-timeline',
    uses: [],
  },
  {
    id: 'contributors-timeline-missing',
    path: '/contributors?timeline=1&sample=missing',
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
    path: '/contributors/account-alice?timeline=1',
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
    path: '/companies?timeline=1',
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
    path: '/companies/id/company-acme?timeline=1',
    access: 'signed-in',
    page: 'company-timeline',
    uses: ['layout-width'],
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
