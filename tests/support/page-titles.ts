// The document title each inventory page group renders for a signed-in viewer.
// Type-only imports keep it loadable wherever the inventory is.
import type { reportViews, signInPages } from './views';

export type PageGroup = (typeof signInPages)[number]['page'] | (typeof reportViews)[number]['page'];

export const pageTitles = {
  'sign-in': 'Sign in',
  'sign-in-error': 'Unable to sign in',
  'account-setup': 'Account access',
  'change-password': 'Change password',
  'repos-summary': 'All repositories',
  'repos-timeline': 'Timeline · All repositories',
  'repo-prs': 'Prebid.js',
  'repo-issues': 'Open issues · Prebid.js',
  'repo-docs-open-issues': 'Open issues · Prebid Documentation',
  'repo-approvals': 'PRs with 0 human approvals · Prebid.js',
  'repo-authors': 'PR authors · Prebid.js',
  'repo-credits': 'Prebid agent reviewer contributions · Prebid.js',
  'repo-durations': 'Merge-duration details · Prebid.js',
  'repo-timeline': 'Timeline · Prebid.js',
  'repo-author-prs': 'PRs by sample-author-2 · Prebid.js',
  'repo-author-issues': 'Issues by sample-author-2 · Prebid.js',
  contributors: 'Contributors',
  'contributors-timeline': 'Over time · Contributors',
  contributor: 'Alice · Contributors',
  'contributor-timeline': 'Over time · Alice',
  companies: 'Companies',
  'companies-timeline': 'Over time · Companies',
  company: 'Example Acme · Companies',
  'company-repositories': 'By repository · Example Acme',
  'company-timeline': 'Over time · Example Acme',
  foundation: 'Component foundation',
} as const satisfies Record<PageGroup, string>;
