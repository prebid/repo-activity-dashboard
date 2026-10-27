import { requireViewer } from '@/lib/auth/viewer';
import { ChangePasswordView } from '@/features/authentication/change-password-view';
export default async function ChangePasswordPage() {
  const user = await requireViewer({ allowPasswordChange: true });
  return (
    <ChangePasswordView
      key={user.id + ':' + user.authVersion}
      email={user.email}
      mustChangePassword={user.mustChangePassword === true}
    />
  );
}
export const dynamic = 'force-dynamic';
