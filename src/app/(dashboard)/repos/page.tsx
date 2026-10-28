import { allRepositories } from '@/server/reporting';
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
export default async function AllReposPage() {
  const { viewer, data } = await allRepositories();
  return <RepositoriesScreen data={data} viewerId={viewer.id} />;
}
