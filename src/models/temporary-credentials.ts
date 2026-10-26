import { z } from 'zod';
export const temporaryPasswordHoursSchema = z.coerce.number().int().min(1).max(168).default(24);
export const temporaryExpirySchema = z.iso
  .datetime()
  .refine(
    (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
    'Expected a canonical UTC timestamp.',
  );
export function temporaryCredentialCurrent(
  user: { mustChangePassword?: boolean; temporaryPasswordExpiresAt?: string },
  now = Date.now(),
): boolean {
  return (
    user.mustChangePassword !== true ||
    (user.temporaryPasswordExpiresAt !== undefined &&
      Date.parse(user.temporaryPasswordExpiresAt) > now)
  );
}
