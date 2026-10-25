import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { isPreviewBuild } from '@/lib/presentation/preview';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (isPreviewBuild || session?.user.role !== 'admin') redirect('/repos');
  return children;
}
