import { contributions } from '@/server/reporting';
import { ContributionsScreen } from '@/app/_screens/contributions-screen';
export default async function Page() {
  const { viewer, rows } = await contributions('companies');
  return <ContributionsScreen title="Companies" rows={rows} viewerId={viewer.id} />;
}
