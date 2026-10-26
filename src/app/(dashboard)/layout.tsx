import { requireViewer } from '@/lib/auth/viewer';
import { Toolbar } from '@/components/layout/toolbar';
import { repositoryCatalog } from '@/config/repositories';
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <>
      <Toolbar repositories={repositoryCatalog} viewer={viewer} />
      <aside aria-label="Data source" className="border-b bg-muted px-4 py-2 text-center text-sm">
        Sample reporting data · Frontend foundation
      </aside>
      <main
        key={viewer.id + ':' + viewer.authVersion}
        className="mx-auto max-w-screen-2xl space-y-6 p-4 md:p-8"
      >
        {children}
      </main>
    </>
  );
}
export const dynamic = 'force-dynamic';
