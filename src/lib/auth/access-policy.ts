export interface AccessUser {
  id: string;
  email: string;
  role?: string;
  mustChangePassword?: boolean;
}
export type AccessDecision =
  { allowed: true; user: AccessUser } | { allowed: false; status: 401 | 403; error: string };
export function accountAccess(
  user: AccessUser | null | undefined,
  options: { preview: boolean; admin?: boolean; allowPasswordChange?: boolean },
): AccessDecision {
  if (options.preview)
    return { allowed: false, status: 403, error: 'Account access is disabled in preview.' };
  if (!user) return { allowed: false, status: 401, error: 'Authentication required' };
  if (user.mustChangePassword && !options.allowPasswordChange)
    return { allowed: false, status: 403, error: 'Password change required' };
  if (options.admin && user.role !== 'admin')
    return { allowed: false, status: 403, error: 'Administrator access required' };
  return { allowed: true, user };
}
