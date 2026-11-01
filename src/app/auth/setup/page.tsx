import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { title: 'Account access' };
export default function SetupPage() {
  return (
    <section className="mx-auto max-w-md space-y-4 rounded-lg border bg-card p-8">
      <h1 className="text-2xl">Accounts are managed by your administrator</h1>
      <p>Contact your administrator for account access.</p>
      <Link href="/auth/login" className="underline">
        Return to sign in
      </Link>
    </section>
  );
}
