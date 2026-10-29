import { z } from 'zod';
import { countSchema, reportingCoverageSchema, type Count } from './reporting-measurement';
import { utcInstantSchema } from './reporting-period';
export const commentMetricIds = ['prComments', 'inlineComments', 'issueComments'] as const;
export type CommentMetric = (typeof commentMetricIds)[number];
export const volumeRoles = ['authored', 'reviewed', 'approved'] as const;
export type VolumeRole = (typeof volumeRoles)[number];
export const changeStatIds = [
  'filesChanged',
  'filesAdded',
  'filesRemoved',
  'filesModified',
  'filesRenamed',
  'filesCopied',
  'filesTypeChanged',
  'linesChanged',
  'linesAdded',
  'linesRemoved',
] as const;
export type ChangeStat = (typeof changeStatIds)[number];
export const fileStatusStats = [
  'filesAdded',
  'filesRemoved',
  'filesModified',
  'filesRenamed',
  'filesCopied',
  'filesTypeChanged',
] as const;
export type VolumeMetric = `${VolumeRole}.${ChangeStat}`;
export type AdditionalMetric = CommentMetric | VolumeMetric;
export const volumeMetricId = (role: VolumeRole, stat: ChangeStat): VolumeMetric =>
  `${role}.${stat}`;
export const additionalMetricIds: readonly AdditionalMetric[] = [
  ...commentMetricIds,
  ...volumeRoles.flatMap((role) => changeStatIds.map((stat) => volumeMetricId(role, stat))),
];
export type AdditionalValues = Record<AdditionalMetric, Count>;
export const changeStatsSchema = z.record(z.enum(changeStatIds), countSchema);
export type ChangeStats = z.infer<typeof changeStatsSchema>;
const identity = z.string().trim().min(1).max(250);
export const contributionActivitySchema = z
  .object({
    coverage: z.record(z.enum(additionalMetricIds), reportingCoverageSchema),
    comments: z.array(
      z
        .object({
          id: identity,
          accountId: identity,
          recordId: identity,
          kind: z.enum(commentMetricIds),
          createdAt: utcInstantSchema,
        })
        .strict(),
    ),
    volumes: z.array(
      z
        .object({
          accountId: identity,
          recordId: identity,
          role: z.enum(volumeRoles),
          qualifiedAt: utcInstantSchema,
        })
        .strict(),
    ),
  })
  .strict();
const statLabels: Record<ChangeStat, string> = {
  filesChanged: 'Files changed',
  filesAdded: 'Files added',
  filesRemoved: 'Files removed',
  filesModified: 'Files modified',
  filesRenamed: 'Files renamed',
  filesCopied: 'Files copied',
  filesTypeChanged: 'File type changes',
  linesChanged: 'Lines changed',
  linesAdded: 'Lines added',
  linesRemoved: 'Lines removed',
};
const roleLabels: Record<VolumeRole, string> = {
  authored: 'Authored merged PR volume',
  reviewed: 'Reviewed merged PR volume',
  approved: 'Approved merged PR volume',
};
const roleMeaning: Record<VolumeRole, string> = {
  authored: 'PRs authored by this account',
  reviewed:
    'PRs where this account provided qualifying non-author reviewer participation before merge',
  approved:
    'PRs where this account gave an approval before merge, independently of effective approval state at merge',
};
export const additionalMetricDefinitions: Record<
  AdditionalMetric,
  { label: string; group: string; description: string; selectionSection?: string }
> = Object.fromEntries([
  [
    'prComments',
    {
      label: 'PR comments',
      group: 'Comment activity',
      description:
        'Posted PR conversation comments, counted once by comment identity in the period created, including author replies. Excludes inline comments and submitted review-summary bodies; edits do not add comments.',
    },
  ],
  [
    'inlineComments',
    {
      label: 'Inline comments',
      group: 'Comment activity',
      description:
        'Posted PR review comments on files or diff lines, including replies, counted once in the period created. This is comment volume, not distinct reviewer contributions.',
    },
  ],
  [
    'issueComments',
    {
      label: 'Issue comments',
      group: 'Comment activity',
      description:
        'Posted comments on issues, excluding PRs, counted once in the period created, including the issue author’s replies. Repeated ingestion and edits do not add comments.',
    },
  ],
  ...volumeRoles.flatMap((role) =>
    changeStatIds.map((stat) => [
      volumeMetricId(role, stat),
      {
        label: statLabels[stat],
        group: roleLabels[role],
        selectionSection: stat.startsWith('files') ? 'Files' : 'Lines',
        description:
          `${statLabels[stat]} in the final diff of ${roleMeaning[role]}, merged into the primary branch during this period. Count each account/PR/role once; repeated reviews or approvals do not multiply volume. Each qualifying account receives the full PR size, not a claim about lines individually written or read. ` +
          (stat === 'filesChanged'
            ? 'The total includes added, removed, modified, renamed, copied and type-changed files.'
            : stat === 'linesChanged'
              ? 'Total lines changed equals additions plus deletions, not net growth.'
              : stat === 'filesTypeChanged'
                ? 'This is Git status T (file type changed), not ordinary content modification.'
                : 'Counts are summed across PRs; the same file can appear in several PRs.'),
      },
    ]),
  ),
]) as Record<
  AdditionalMetric,
  { label: string; group: string; description: string; selectionSection?: string }
>;
