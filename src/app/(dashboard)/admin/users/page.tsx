import { requireViewer } from '@/lib/auth/viewer';
import UsersView from '@/features/administration/users-view';
export default async function UsersPage() {
  await requireViewer({ admin: true });
  return <UsersView />;
}
