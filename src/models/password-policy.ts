// Keep the same new-password policy in both forms and server validation.
export const minimumPasswordLength = 6;
export function fitsPasswordByteLimit(password: string): boolean {
  return new TextEncoder().encode(password).length <= 72;
}
export const passwordRequirements = [
  {
    test: (password: string) => Array.from(password).length >= minimumPasswordLength,
    text: `At least ${minimumPasswordLength} characters`,
    error: `Password must be at least ${minimumPasswordLength} characters`,
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
