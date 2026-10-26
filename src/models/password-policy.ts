// Shared by the new-password form and server validation.
export const minimumPasswordLength = 6;

export function fitsPasswordByteLimit(password: string): boolean {
  return new TextEncoder().encode(password).length <= 72;
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < minimumPasswordLength)
    errors.push(`Password must be at least ${minimumPasswordLength} characters`);
  if (!fitsPasswordByteLimit(password)) errors.push('Password must be at most 72 UTF-8 bytes');
  return { valid: errors.length === 0, errors };
}
