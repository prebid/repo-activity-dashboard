import View from '@/features/current-reports/dashboard-view';
import { requirePageAccess } from '@/lib/auth/site-access';
export const dynamic = 'force-dynamic';
export default async function Page() {
  await requirePageAccess();
  return <View />;
}
