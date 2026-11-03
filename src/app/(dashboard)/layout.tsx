import { cookies } from 'next/headers';
import { requireViewer } from '@/lib/auth/viewer';
import { Toolbar } from '@/components/layout/toolbar';
import { repositoryCatalog } from '@/config/repositories';
import { Fragment } from 'react';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
import { layoutWidthCookie, parseLayoutWidth } from '@/lib/presentation/layout-width';
import { PreferenceNotice } from '@/components/feedback/preference-notice';
import { PreferenceBindingProvider } from '@/lib/navigation/preference-binding';
import { HistoryEntryMarker } from '@/lib/navigation/use-url-state';
import { repositoryClock } from '@/server/activity-database';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const layoutWidth = parseLayoutWidth((await cookies()).get(layoutWidthCookie)?.value);
  const asOf = repositoryClock();
  return (
    <PreferenceBindingProvider binding={{ accountId: viewer.id, authVersion: viewer.authVersion }}>
      <HistoryEntryMarker />
      <DashboardFrame
        layoutWidth={layoutWidth}
        navigation={<Toolbar repositories={repositoryCatalog} viewer={viewer} asOf={asOf} />}
      >
        <Fragment key={viewer.id + ':' + viewer.authVersion}>
          <PreferenceNotice />
          {children}
        </Fragment>
      </DashboardFrame>
    </PreferenceBindingProvider>
  );
}
export const dynamic = 'force-dynamic';
