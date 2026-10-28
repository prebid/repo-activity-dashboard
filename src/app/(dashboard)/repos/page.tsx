import { allRepositories } from '@/server/reporting';
import { RepositoriesScreen } from '@/app/_screens/repositories-screen';
export default async function AllReposPage() {
  const { viewer, samples } = await allRepositories();
  return <RepositoriesScreen samples={samples} viewerId={viewer.id} />;
}
