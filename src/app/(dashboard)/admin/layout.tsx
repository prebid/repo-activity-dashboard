import { requireViewer } from '@/lib/auth/viewer';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireViewer({ admin: true });
  return children;
}
