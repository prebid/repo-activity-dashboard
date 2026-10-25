import { NextResponse } from 'next/server';
import { adminCreateUser, getUserByEmail } from '@/lib/auth/users';
import { getAllWhitelistedEmails } from '@/lib/auth/whitelist';
import { requireAccountAccess } from '@/lib/auth/api-access';
import { readRequestBody } from '@/lib/auth/request-body';
import { createAccountSchema } from '@/models/accounts';
export async function GET() {
  try {
    const access = await requireAccountAccess({ admin: true });
    if (!access.ok) return access.response;
    return NextResponse.json({ users: await getAllWhitelistedEmails() });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const access = await requireAccountAccess({ admin: true });
    if (!access.ok) return access.response;
    const body = await readRequestBody(request, createAccountSchema);
    if (!body.ok) return body.response;
    const { email, name, role, company } = body.data;
    if (await getUserByEmail(email))
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    const { user, tempPassword } = await adminCreateUser(
      email,
      name,
      role,
      company,
      access.user.email,
    );
    return NextResponse.json({
      message: 'User created successfully',
      userId: user.id,
      email: user.email,
      tempPassword,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
