import { NextResponse } from 'next/server';
import { adminResetPassword } from '@/lib/auth/users';
import { requireAccountMutationAccess } from '@/lib/auth/api-access';
import { readRequestBody } from '@/lib/auth/request-body';
import { resetAccountSchema } from '@/models/accounts';
import { accountErrorResponse } from '@/lib/auth/account-response';
export async function POST(request: Request) {
  try {
    const access = await requireAccountMutationAccess(request, { admin: true });
    if (!access.ok) return access.response;
    const body = await readRequestBody(request, resetAccountSchema);
    if (!body.ok) return body.response;
    const credential = await adminResetPassword(body.data.email, {
      kind: 'session',
      ...access.user,
    });
    return NextResponse.json({ message: 'Password reset successfully', ...credential });
  } catch (error) {
    return accountErrorResponse(error, 'Failed to reset password');
  }
}
