import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { title: 'Page not found' };
export default function NotFound() {
  return (
    <section>
      <h1 className="text-2xl">Page not found</h1>
      <Link prefetch={false} href="/repos" className="underline">
        Back to all repositories
      </Link>
    </section>
  );
}
