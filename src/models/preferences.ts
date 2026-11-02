/** The two preference cookies, one per report area. */
export const preferenceCookieNames = ['repositories', 'contributions'] as const;
export type PreferenceCookieName = (typeof preferenceCookieNames)[number];

/**
 * Every section each cookie can hold. A section is keyed by view kind and table kind, never by a
 * repository, account, company or sample, so one choice applies across them.
 */
export const preferenceSectionKeys = {
  repositories: [
    // All repositories settings and the sorts of its two tables.
    'overview',
    'overview.backlog.sort',
    'overview.activity.sort',
    // Repository record lists, per list kind.
    'repository.prs.columns',
    'repository.issues.columns',
    'repository.prs.sort',
    'repository.issues.sort',
    // Repository insight tables.
    'repository.merged-prs.sort',
    'repository.authors.sort',
    'repository.credits.sort',
    // Timeline presentation for the repository matrix and for a repository.
    'timeline.matrix',
    'timeline.repository',
    // Timeline supporting records, per detail kind and record kind.
    'timeline-support.repository.prs.sort',
    'timeline-support.repository.issues.sort',
    'timeline-support.authors.prs.sort',
    'timeline-support.authors.issues.sort',
  ],
  contributions: [
    // The report scope, shared by Contributors, Companies and their Timelines.
    'contributions.scope',
    // Columns and sort per contribution table kind.
    'contributions.details.columns',
    'contributions.details.sort',
    'contributions.contributors.columns',
    'contributions.contributors.sort',
    'contributions.companies.columns',
    'contributions.companies.sort',
    'contributions.members.columns',
    'contributions.members.sort',
    'contributions.repositories.columns',
    'contributions.repositories.sort',
    // Timeline presentation per area and focus kind.
    'timeline.contributors.overview',
    'timeline.contributors.contributor',
    'timeline.contributors.company',
    'timeline.companies.overview',
    'timeline.companies.contributor',
    'timeline.companies.company',
    // Timeline supporting contribution records.
    'timeline-support.contribution.sort',
  ],
} as const satisfies Record<PreferenceCookieName, readonly string[]>;

export type PreferenceSectionKeyOf<C extends PreferenceCookieName> =
  (typeof preferenceSectionKeys)[C][number];
export type PreferenceSectionKey = PreferenceSectionKeyOf<PreferenceCookieName>;

/** The session a saved value belongs to; a value saved for another account or revision is ignored. */
export interface PreferenceBinding {
  accountId: string;
  authVersion: number;
}

/**
 * One cookie section after server validation, as route composition hands it to a client hook. The
 * binding lets the hook write the section back for the same session.
 */
export interface SavedPreference<T> {
  section: PreferenceSectionKey;
  binding: PreferenceBinding;
  /** The validated value, or null when the section is absent, not applicable, or invalid. */
  value: T | null;
  /**
   * The section's stored JSON, present only when the server rejected it. After hydration the client
   * deletes the section if the cookie still holds exactly this value.
   */
  invalid?: string;
}
