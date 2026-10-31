import { z } from 'zod';

// Display contracts only: no GitHub events, database records, or table-library types.
function measurementSchema(value: z.ZodNumber) {
  return z.discriminatedUnion('status', [
    z.object({ status: z.literal('complete'), value }).strict(),
    z.object({ status: z.literal('partial'), value, reason: z.string().trim().min(1) }).strict(),
    z
      .object({ status: z.literal('missing'), value: z.null(), reason: z.string().trim().min(1) })
      .strict(),
    z
      .object({
        status: z.literal('not-applicable'),
        value: z.null(),
        reason: z.string().trim().min(1),
      })
      .strict(),
  ]);
}
export const countSchema = measurementSchema(
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
);
export const durationSchema = measurementSchema(z.number().nonnegative());
export type Measurement = z.infer<typeof durationSchema>;
export type Count = z.infer<typeof countSchema>;

export const reportingCoverageSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('complete') }).strict(),
  z.object({ status: z.literal('partial'), reason: z.string().trim().min(1) }).strict(),
  z.object({ status: z.literal('missing'), reason: z.string().trim().min(1) }).strict(),
]);
export type ReportingCoverage = z.infer<typeof reportingCoverageSchema>;
