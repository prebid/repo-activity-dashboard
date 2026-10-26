import { accountJson } from '@/lib/auth/account-response';
export function GET() {
  return accountJson({ error: 'Public account setup is disabled.' }, { status: 403 });
}
