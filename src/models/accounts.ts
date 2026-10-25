import { z } from 'zod';

export const emailSchema = z.string().trim().email().toLowerCase();
const optionalText = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
export const credentialSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const createAccountSchema = z.object({
  email: emailSchema,
  name: optionalText,
  company: optionalText,
  role: z.enum(['viewer', 'admin']).default('viewer'),
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
  role: z.string().optional(),
  company: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  mustChangePassword: z.boolean().optional(),
  lastPasswordChange: z.string().optional(),
  lastLogin: z.string().optional(),
});
export type AccountRecord = z.infer<typeof accountRecordSchema>;
export type AuthenticatedUser = Pick<
  AccountRecord,
  'id' | 'email' | 'name' | 'role' | 'company' | 'mustChangePassword'
>;
export const whitelistRecordSchema = z.object({
  email: emailSchema,
  role: z.string().default('viewer'),
  isActive: z.boolean(),
  addedAt: z.string().optional(),
  addedBy: z.string().optional(),
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
export const setupStatusSchema = z.object({ hasUsers: z.boolean() });
export const errorResponseSchema = z.object({ error: z.string() });
