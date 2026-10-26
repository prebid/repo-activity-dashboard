import { z } from 'zod';
import { temporaryExpirySchema } from './temporary-credentials';

export const emailSchema = z.string().trim().email().toLowerCase();
export const accountRoles = ['viewer', 'user', 'admin'] as const;
export const accountRoleSchema = z.enum(accountRoles);
export type AccountRole = z.infer<typeof accountRoleSchema>;
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
export const whitelistResponseSchema = z.object({ users: z.array(whitelistRecordSchema) });
export const createdAccountResponseSchema = z.object({
  message: z.string(),
  userId: z.string(),
  email: emailSchema,
  tempPassword: z.string().min(1),
  expiresAt: temporaryExpirySchema,
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
