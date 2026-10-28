import { requireViewer } from '@/lib/auth/viewer';
import { Toolbar } from '@/components/layout/toolbar';
import { repositoryCatalog } from '@/config/repositories';
import { Fragment } from 'react';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <DashboardFrame navigation={<Toolbar repositories={repositoryCatalog} viewer={viewer} />}>
      <Fragment key={viewer.id + ':' + viewer.authVersion}>{children}</Fragment>
    </DashboardFrame>
  );
}
export const dynamic = 'force-dynamic';
