import { accountJson } from '@/lib/auth/account-response';
export function POST() {
  return accountJson({ error: 'Account provisioning is operator-only.' }, { status: 403 });
}
