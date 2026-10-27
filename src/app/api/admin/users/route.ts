import { getServerAccountStore } from '@/lib/auth/server-account-store';
import { accountJson, accountErrorResponse } from '@/lib/auth/account-response';
import { requireAccountAccess, requireAccountMutationAccess } from '@/lib/auth/api-access';
import { readRequestBody } from '@/lib/auth/request-body';
import { createAccountSchema } from '@/models/accounts';
export async function GET() {
  try {
    const access = await requireAccountAccess({ admin: true });
    if (!access.ok) return access.response;
    return accountJson({ users: await getServerAccountStore().listAccountSummaries() });
  } catch {
    return accountJson({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const access = await requireAccountMutationAccess(request, { admin: true });
    if (!access.ok) return access.response;
    const body = await readRequestBody(request, createAccountSchema);
    if (!body.ok) return body.response;
    const { email, name, role, company } = body.data;
    const { user, tempPassword, expiresAt } = await getServerAccountStore().adminCreateUser(
      email,
      name,
      role,
      company,
      {
        kind: 'session',
        ...access.user,
      },
    );
    return accountJson({
      message: 'User created successfully',
      userId: user.id,
      email: user.email,
      tempPassword,
      expiresAt,
    });
  } catch (error) {
    return accountErrorResponse(error, 'Failed to create user');
  }
}
