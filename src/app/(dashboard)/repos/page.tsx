import { allRepositories } from '@/server/reporting';
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
export default async function AllReposPage() {
  const { viewer, rows, asOfLabel } = await allRepositories();
  return <RepositoriesScreen rows={rows} asOfLabel={asOfLabel} viewerId={viewer.id} />;
}
