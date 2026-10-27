import Link from 'next/link';
export default function RepositoryNotFound() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Repository not found</h1>
      <Link prefetch={false} href="/repos" className="underline">
        Back to all repositories
      </Link>
    </section>
  );
}
