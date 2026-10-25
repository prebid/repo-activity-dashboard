import { LoginView } from '@/features/authentication/login-view';
import { isPreviewBuild } from '@/lib/presentation/preview';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  return <LoginView preview={isPreviewBuild} callbackUrl={params.callbackUrl} />;
}
