import { redirect } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
export default async function Home() {
  await requireViewer();
  redirect('/repos');
}
export const dynamic = 'force-dynamic';
