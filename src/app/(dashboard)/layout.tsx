import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { safeReturnPath } from '@/lib/presentation/navigation';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    const destination = safeReturnPath((await headers()).get('x-dashboard-return-path'));
    redirect('/auth/login?callbackUrl=' + encodeURIComponent(destination));
  }
  if (session.user.mustChangePassword) redirect('/auth/change-password');
  return children;
}

export const dynamic = 'force-dynamic';
