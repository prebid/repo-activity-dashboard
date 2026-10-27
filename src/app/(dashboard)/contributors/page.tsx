import { contributions } from '@/server/reporting';
import { ContributionsScreen } from '@/app/_screens/contributions-screen';
export default async function Page() {
  const { viewer, rows } = await contributions('contributors');
  return <ContributionsScreen title="Contributors" rows={rows} viewerId={viewer.id} />;
}
