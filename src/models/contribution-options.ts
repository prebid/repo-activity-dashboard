import { z } from 'zod';
import { contributionSampleScenarios } from './contribution-page';
import { contributionSettingsSchema, type ContributionSettings } from './contribution-settings';
import { tablePageSize } from './table-query';
export const choiceQuerySchema = z
  .object({
    kind: z.enum(['accounts', 'companies']),
    search: z.string().max(200),
    page: z.number().int().min(0).max(1000000),
    selectedIds: z.array(z.string().max(200)).max(4096).nullable(),
  })
  .strict();
export type ContributionChoiceQuery = z.infer<typeof choiceQuerySchema>;
export const choicePageSchema = z
  .object({
    choices: z
      .array(z.object({ value: z.string().max(200), label: z.string().min(1).max(500) }).strict())
      .max(tablePageSize),
    total: z.number().int().nonnegative(),
    page: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (value) =>
      value.page < Math.max(1, Math.ceil(value.total / tablePageSize)) &&
      value.choices.length ===
        Math.min(tablePageSize, Math.max(0, value.total - value.page * tablePageSize)) &&
      new Set(value.choices.map((choice) => choice.value)).size === value.choices.length,
    'Inconsistent choice page',
  );
export type ContributionChoicePage = z.infer<typeof choicePageSchema>;
export const contributionOptionsRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('choices'),
      sample: z.enum(contributionSampleScenarios),
      query: choiceQuerySchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('validate'),
      sample: z.enum(contributionSampleScenarios),
      settings: contributionSettingsSchema,
    })
    .strict(),
]);
export const preferenceCheckSchema = z
  .object({ settings: contributionSettingsSchema.nullable() })
  .strict();
export interface ContributionOptions {
  choices(query: ContributionChoiceQuery, signal: AbortSignal): Promise<ContributionChoicePage>;
  validate(
    settings: ContributionSettings,
    signal: AbortSignal,
  ): Promise<ContributionSettings | null>;
}
