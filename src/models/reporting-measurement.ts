import { z } from 'zod';

// A missing value the reporting database does not collect yet, as opposed to a gap in what it does
// collect. It stays unknown, never zero, and is shown in orange as work still to connect.
const notConnectedFlag = z.literal(true).optional();

// Display contracts only: no GitHub events, database records, or table-library types.
function measurementSchema(value: z.ZodNumber) {
  return z.discriminatedUnion('status', [
    z.object({ status: z.literal('complete'), value }).strict(),
    z.object({ status: z.literal('partial'), value, reason: z.string().trim().min(1) }).strict(),
    z
      .object({
        status: z.literal('missing'),
        value: z.null(),
        reason: z.string().trim().min(1),
        notConnected: notConnectedFlag,
      })
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
  z
    .object({
      status: z.literal('missing'),
      reason: z.string().trim().min(1),
      notConnected: notConnectedFlag,
    })
    .strict(),
]);
export type ReportingCoverage = z.infer<typeof reportingCoverageSchema>;

/** A value the reporting database does not collect yet; `reason` names what is still to connect. */
export function notConnected(reason: string) {
  return { status: 'missing', value: null, reason, notConnected: true } as const;
}
/** Whether a value or coverage is missing because its data is not connected yet. */
export function isNotConnected(value: { status: string; notConnected?: true }): boolean {
  return value.status === 'missing' && value.notConnected === true;
}
