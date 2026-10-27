import { requireAccountMutationAccess } from '@/lib/auth/api-access';
import { readRequestBody } from '@/lib/auth/request-body';
import { changePasswordSchema } from '@/models/accounts';
import { getServerAccountStore } from '@/lib/auth/server-account-store';
import { verifyPassword, hashPassword, validatePasswordStrength } from '@/lib/auth/passwords';
import { accountJson, accountErrorResponse } from '@/lib/auth/account-response';
export async function POST(request: Request) {
  try {
    const access = await requireAccountMutationAccess(request, { allowPasswordChange: true });
    if (!access.ok) return access.response;
    const body = await readRequestBody(request, changePasswordSchema);
    if (!body.ok) return body.response;
    const { currentPassword, newPassword } = body.data;
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid)
      return accountJson({ error: validation.errors.join('. ') }, { status: 400 });
    const store = getServerAccountStore();
    const user = await store.getUserById(access.user.id);
    if (!user) return accountJson({ error: 'User not found' }, { status: 404 });
    if (!(await verifyPassword(currentPassword, user.password)))
      return accountJson({ error: 'Current password is incorrect' }, { status: 400 });
    if (await verifyPassword(newPassword, user.password))
      return accountJson({ error: 'Choose a different password.' }, { status: 400 });
    await store.changeOwnPassword(user, await hashPassword(newPassword), access.user);
    return accountJson({ message: 'Password changed successfully', redirect: '/' });
  } catch (error) {
    return accountErrorResponse(error, 'Failed to change password');
  }
}
