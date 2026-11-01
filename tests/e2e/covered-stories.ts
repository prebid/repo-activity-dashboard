// Every Storybook story id, which story-coverage.spec.ts opens in Light and Dark with axe.
// Test titles come from this list because CI lists browser cases before Storybook is built.
// It has no imports so Playwright, Vitest and Node's type stripping can all load it.
export type StoryTheme = 'light' | 'dark';
/** The phase that owns the component a recorded violation sits in. */
export type OwningPhase = 'P2' | 'P3' | 'P4';
export interface KnownViolation {
  readonly story: string;
  readonly theme: StoryTheme;
  /** An axe rule id. */
  readonly rule: string;
  readonly phase: OwningPhase;
  readonly reason: string;
}

export const coveredStories = [
  'authentication-pages--sign-in',
  'authentication-pages--password-changed',
  'authentication-pages--temporary-password',
  'authentication-pages--change-password',
  'authentication-pages--sign-in-error',
  'contributions-supporting-records--credits',
  'contributions-supporting-records--comments',
  'contributions-supporting-records--volume',
  'contributions-supporting-records--large',
  'contributions-supporting-records--missing',
  'contributions-pages--contributors',
  'contributions-pages--companies',
  'contributions-pages--contributor',
  'contributions-pages--company',
  'contributions-pages--unmapped',
  'contributions-pages--large',
  'contributions-pages--coverage-gap',
  'contributions-pages--company-coverage-gap',
  'contributions-pages--busy-contributor',
  'contributions-pages--partial',
  'contributions-pages--missing',
  'contributions-pages--empty',
  'contributions-pages--error',
  'foundation-tokens--surfaces',
  'foundation-tokens--text',
  'foundation-tokens--lines',
  'foundation-tokens--brand-and-state',
  'foundation-tokens--elevation',
  'foundation-tokens--radii',
  'foundation-tokens--type',
  'foundation-tokens--chart',
  'foundation-shared-components--normal',
  'foundation-shared-components--empty',
  'foundation-shared-components--loading',
  'foundation-shared-components--error',
  'foundation-interactive-primitives--keyboard',
  'navigation-click-feedback--idle',
  'navigation-click-feedback--pending',
  'repositories-all-repositories--overview',
  'repositories-all-repositories--two-periods',
  'repositories-all-repositories--administration',
  'repositories-all-repositories--empty',
  'repositories-all-repositories--loading',
  'repositories-all-repositories--error',
  'repositories-author-records--pull-requests',
  'repositories-author-records--issues',
  'reports-repository-charts--current',
  'reports-repository-charts--activity',
  'repositories-supporting-details--pr-authors',
  'repositories-supporting-details--issue-authors',
  'repositories-supporting-details--agent-reviewers',
  'repositories-supporting-details--agent-approvals',
  'repositories-supporting-details--bot-reviewers',
  'repositories-supporting-details--bot-approvals',
  'repositories-supporting-details--merge-duration',
  'repositories-supporting-details--empty-authors',
  'repositories-supporting-details--no-merges',
  'repositories-supporting-details--missing',
  'repositories-supporting-details--partial',
  'repositories-record-lists--open-p-rs',
  'repositories-record-lists--merged',
  'repositories-record-lists--issues',
  'repositories-record-lists--empty',
  'repositories-record-lists--partial',
  'repositories-record-lists--missing',
  'timelines-repository-matrix--monthly',
  'timelines-repository-matrix--weekly',
  'timelines-repository-matrix--mixed-coverage',
  'timelines-repository-matrix--merge-duration',
  'timelines-repository-matrix--issue-activity',
  'timelines-repository-matrix--historical-backlog',
  'timelines-repository-matrix--dense',
  'timelines-repository-matrix--no-repositories',
  'timelines-repository-matrix--known-zero',
  'timelines-repository-matrix--unavailable',
  'timelines-layouts--repository',
  'timelines-layouts--issues',
  'timelines-layouts--weekly-issues',
  'timelines-layouts--historical-snapshots',
  'timelines-layouts--contributors',
  'timelines-layouts--companies',
  'timelines-layouts--person',
  'timelines-layouts--company',
  'timelines-layouts--partial',
  'timelines-layouts--missing',
  'timelines-layouts--zero-activity',
  'timelines-layouts--empty-selection',
  'timelines-layouts--dense-repository',
  'timelines-layouts--dense-contributions',
  'timelines-layouts--loading',
  'timelines-layouts--error',
] as const satisfies readonly string[];

/**
 * Violations the spec expects until their owning phase fixes them. An entry fails once its
 * violation is gone, so fixing one means deleting it here.
 */
export const knownViolations: readonly KnownViolation[] = [];
