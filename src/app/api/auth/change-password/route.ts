import { NextResponse } from 'next/server';
import { requireAccountAccess } from '@/lib/auth/api-access';
import { readRequestBody } from '@/lib/auth/request-body';
import { changePasswordSchema } from '@/models/accounts';
import { getUserById, updateUserPassword } from '@/lib/auth/users';
import { verifyPassword, hashPassword, validatePasswordStrength } from '@/lib/auth/passwords';
import { accountErrorResponse } from '@/lib/auth/account-response';
export async function POST(request: Request) {
  try {
    const access = await requireAccountAccess({ allowPasswordChange: true });
    if (!access.ok) return access.response;
    const body = await readRequestBody(request, changePasswordSchema);
    if (!body.ok) return body.response;
    const { currentPassword, newPassword } = body.data;
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid)
      return NextResponse.json({ error: validation.errors.join('. ') }, { status: 400 });
    const user = await getUserById(access.user.id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!(await verifyPassword(currentPassword, user.password)))
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    if (await verifyPassword(newPassword, user.password))
      return NextResponse.json({ error: 'Choose a different password.' }, { status: 400 });
    await updateUserPassword(
      user,
      await hashPassword(newPassword),
      { kind: 'session', ...access.user },
      false,
    );
    return NextResponse.json({ message: 'Password changed successfully', redirect: '/' });
  } catch (error) {
    return accountErrorResponse(error, 'Failed to change password');
  }
}
