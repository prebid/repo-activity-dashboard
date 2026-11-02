import type { Metadata } from 'next';
import { LoginView } from '@/features/authentication/login-view';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { firstSearchParam, type PageSearchParams } from '@/lib/presentation/search-params';
export const metadata: Metadata = { title: 'Sign in' };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  return (
    <LoginView
      preview={isPreviewBuild}
      callbackUrl={firstSearchParam(params.callbackUrl)}
      passwordChanged={firstSearchParam(params.passwordChanged) === 'true'}
    />
  );
}
