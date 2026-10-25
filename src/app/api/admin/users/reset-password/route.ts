import { NextResponse } from 'next/server';
import { adminResetPassword } from '@/lib/auth/users';
import { requireAccountAccess } from '@/lib/auth/api-access';
import { readRequestBody } from '@/lib/auth/request-body';
import { resetAccountSchema } from '@/models/accounts';
export async function POST(request: Request) {
  try {
    const access = await requireAccountAccess({ admin: true });
    if (!access.ok) return access.response;
    const body = await readRequestBody(request, resetAccountSchema);
    if (!body.ok) return body.response;
    const { tempPassword } = await adminResetPassword(body.data.email);
    return NextResponse.json({ message: 'Password reset successfully', tempPassword });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === 'User not found'
            ? 'User not found'
            : 'Failed to reset password',
      },
      { status: error instanceof Error && error.message === 'User not found' ? 404 : 500 },
    );
  }
}
