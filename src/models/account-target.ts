import { z } from 'zod';
export const accountRegionSchema = z.string().regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/);
export const accountTableNameSchema = z.string().regex(/^[A-Za-z0-9_.-]{3,255}$/);
export const accountTargetSchema = z
  .object({
    region: accountRegionSchema,
    usersTable: accountTableNameSchema,
    whitelistTable: accountTableNameSchema,
  })
  .strict()
  .refine(
    (value) => value.usersTable !== value.whitelistTable,
    'Account and whitelist tables must be distinct.',
  );
export type AccountTarget = z.infer<typeof accountTargetSchema>;
