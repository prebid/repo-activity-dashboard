import { requireViewer } from '@/lib/auth/viewer';
import { ChangePasswordView } from '@/features/authentication/change-password-view';
import { firstSearchParam, type PageSearchParams } from '@/lib/presentation/search-params';
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await requireViewer({ allowPasswordChange: true });
  const params = await searchParams;
  return (
    <ChangePasswordView
      key={user.id + ':' + user.authVersion}
      email={user.email}
      mustChangePassword={user.mustChangePassword === true}
      callbackUrl={firstSearchParam(params.callbackUrl)}
    />
  );
}
export const dynamic = 'force-dynamic';
