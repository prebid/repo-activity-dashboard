import Link from 'next/link';
export default function AuthErrorPage() {
  return (
    <section className="mx-auto max-w-md rounded-lg border bg-card p-8">
      <h1 className="text-2xl font-semibold">Unable to sign in</h1>
      <p className="my-4">Please try again or contact your administrator.</p>
      <Link href="/auth/login" className="underline">
        Return to sign in
      </Link>
    </section>
  );
}
