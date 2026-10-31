import { cookies } from 'next/headers';
import { requireViewer } from '@/lib/auth/viewer';
import { Toolbar } from '@/components/layout/toolbar';
import { repositoryCatalog } from '@/config/repositories';
import { Fragment } from 'react';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
import { layoutWidthCookie, parseLayoutWidth } from '@/lib/presentation/layout-width';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const layoutWidth = parseLayoutWidth((await cookies()).get(layoutWidthCookie)?.value);
  return (
    <DashboardFrame
      layoutWidth={layoutWidth}
      navigation={<Toolbar repositories={repositoryCatalog} viewer={viewer} />}
    >
      <Fragment key={viewer.id + ':' + viewer.authVersion}>{children}</Fragment>
    </DashboardFrame>
  );
}
export const dynamic = 'force-dynamic';
