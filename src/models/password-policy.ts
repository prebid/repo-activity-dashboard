// Keep the same new-password policy in both forms and server validation.
export function fitsPasswordByteLimit(password: string): boolean {
  return new TextEncoder().encode(password).length <= 72;
}
export const passwordRequirements = [
  {
    test: (password: string) => password.length >= 8,
    text: 'At least 8 characters',
    error: 'Password must be at least 8 characters',
  },
  {
    test: (password: string) => /[A-Z]/.test(password),
    text: 'One uppercase letter',
    error: 'Password must contain at least one uppercase letter',
  },
  {
    test: (password: string) => /[a-z]/.test(password),
    text: 'One lowercase letter',
    error: 'Password must contain at least one lowercase letter',
  },
  {
    test: (password: string) => /[0-9]/.test(password),
    text: 'One number',
    error: 'Password must contain at least one number',
  },
  {
    test: fitsPasswordByteLimit,
    text: 'At most 72 bytes; some characters use more than one',
    error: 'Password must be at most 72 UTF-8 bytes',
  },
] as const;
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors = passwordRequirements
    .filter((rule) => !rule.test(password))
    .map((rule) => rule.error);
  return { valid: errors.length === 0, errors };
}
