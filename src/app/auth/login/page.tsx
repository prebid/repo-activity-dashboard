import { LoginView } from "@/features/authentication/login-view";
export const dynamic = "force-dynamic";
export default function LoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const callbackUrl =
    typeof searchParams.callbackUrl === "string"
      ? searchParams.callbackUrl
      : undefined;
  return (
    <LoginView
      preview={false}
      callbackUrl={callbackUrl}
      passwordChanged={searchParams.passwordChanged === "true"}
    />
  );
}
