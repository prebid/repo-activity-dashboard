import { z } from 'zod';
import { temporaryExpirySchema } from './temporary-credentials';

export const emailSchema = z.string().trim().email().toLowerCase();
export const accountRoles = ['viewer', 'user', 'admin'] as const;
export const accountRoleSchema = z.enum(accountRoles);
export type AccountRole = z.infer<typeof accountRoleSchema>;
export function effectiveAccountRole(account: AccountRole, access: AccountRole): AccountRole {
  return accountRoles[Math.min(accountRoles.indexOf(account), accountRoles.indexOf(access))];
}
const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
export const verificationPasswordSchema = z
  .string()
  .min(1)
  .refine(
    (value) => new TextEncoder().encode(value).byteLength <= 1024,
    'Password input is too long.',
  );
export const credentialSchema = z.object({
  email: emailSchema,
  password: verificationPasswordSchema,
});
export const createAccountSchema = z.object({
  email: emailSchema,
  name: optionalText,
  company: optionalText,
  role: accountRoleSchema.default('viewer'),
});
export const resetAccountSchema = z.object({ email: emailSchema });
export const changePasswordSchema = z.object({
  currentPassword: verificationPasswordSchema,
  newPassword: z.string().min(1),
});
export const accountRecordSchema = z.object({
  id: z.string().min(1),
  email: emailSchema,
  password: z.string().min(1),
  name: z.string().optional(),
  role: accountRoleSchema.default('viewer'),
  company: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  mustChangePassword: z.boolean().optional(),
  temporaryPasswordExpiresAt: temporaryExpirySchema.optional(),
  lastPasswordChange: z.string().optional(),
  lastLogin: z.string().optional(),
  authVersion: z.number().int().nonnegative().safe().default(0),
});
export type AccountRecord = z.infer<typeof accountRecordSchema>;
export type AuthenticatedUser = Pick<
  AccountRecord,
  'id' | 'email' | 'name' | 'role' | 'company' | 'mustChangePassword' | 'authVersion'
>;
export const whitelistRecordSchema = z.object({
  email: emailSchema,
  role: accountRoleSchema.default('viewer'),
  isActive: z.boolean(),
  addedAt: z.union([z.string(), z.number().finite()]).optional(),
  addedBy: z.string().optional(),
  userId: z.string().min(1).optional(),
});
export type WhitelistRecord = z.infer<typeof whitelistRecordSchema>;
export const accountSummarySchema = z.object({
  email: emailSchema,
  accountId: z.string().nullable(),
  role: accountRoleSchema.nullable(),
  status: z.enum(['active', 'inactive', 'unprovisioned', 'migration-required']),
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;
export const accountListResponseSchema = z.object({ users: z.array(accountSummarySchema) });
export function summarizeAccount(
  email: string,
  user: AccountRecord | null,
  access: WhitelistRecord | null,
): AccountSummary {
  return {
    email,
    accountId: user?.id ?? null,
    role:
      user && access?.isActive && access.userId === user.id
        ? effectiveAccountRole(user.role, access.role)
        : null,
    status: !user
      ? 'unprovisioned'
      : !access?.isActive
        ? 'inactive'
        : access.userId !== user.id
          ? 'migration-required'
          : 'active',
  };
}
export const createdAccountResponseSchema = z.object({
  message: z.string(),
  userId: z.string(),
  email: emailSchema,
  tempPassword: z.string().min(1),
  expiresAt: temporaryExpirySchema.nullable(),
});
export const messageResponseSchema = z.object({ message: z.string() });
export const errorResponseSchema = z.object({ error: z.string() });

export const resetCredentialResponseSchema = createdAccountResponseSchema.pick({
  message: true,
  email: true,
  tempPassword: true,
  expiresAt: true,
});
export type IssuedCredential = Pick<
  z.infer<typeof createdAccountResponseSchema>,
  'email' | 'tempPassword' | 'expiresAt'
>;
