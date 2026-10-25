import Link from 'next/link';
export default function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Repository not found</h1>
      <Link href="/repos" className="underline">
        Back to all repositories
      </Link>
    </section>
  );
}
