import Link from "next/link";
import { requirePageAccess } from "@/lib/auth/site-access";
export const dynamic = "force-dynamic";
export default async function SetupPage() {
  await requirePageAccess({ admin: true });
  return (
    <section className="mx-auto max-w-md space-y-4 p-8">
      <h1>Account administration</h1>
      <p>
        Manage accounts and temporary passwords from the existing administrator
        page.
      </p>
      <Link href="/admin/users">Manage users</Link>
    </section>
  );
}
