import { ChangePasswordView } from "@/features/authentication/change-password-view";
import { requirePageAccess } from "@/lib/auth/site-access";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePageAccess({ allowPasswordChange: true });
  return (
    <ChangePasswordView
      key={user.id + ":" + user.mustChangePassword}
      email={user.email}
      mustChangePassword={user.mustChangePassword === true}
      callbackUrl={
        typeof searchParams.callbackUrl === "string"
          ? searchParams.callbackUrl
          : undefined
      }
    />
  );
}
