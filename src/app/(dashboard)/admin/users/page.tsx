import type { Metadata } from 'next';
import { requireViewer } from '@/lib/auth/viewer';
import UsersView from '@/features/administration/users-view';
export const metadata: Metadata = { title: 'Accounts' };
export default async function UsersPage() {
  await requireViewer({ admin: true });
  return <UsersView />;
}
