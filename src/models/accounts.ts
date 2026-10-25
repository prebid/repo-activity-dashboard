import { z } from 'zod';

export const emailSchema = z.string().trim().email().toLowerCase();
export const accountRoles = ['viewer', 'user', 'admin'] as const;
export const accountRoleSchema = z.enum(accountRoles);
export type AccountRole = z.infer<typeof accountRoleSchema>;
const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
export const credentialSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const createAccountSchema = z.object({
  email: emailSchema,
  name: optionalText,
  company: optionalText,
  role: accountRoleSchema.default('viewer'),
});
export const resetAccountSchema = z.object({ email: emailSchema });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
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
  addedAt: z.string().optional(),
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
});
export const messageResponseSchema = z.object({ message: z.string() });
export const errorResponseSchema = z.object({ error: z.string() });
