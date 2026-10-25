import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
export default async function Home() {
  redirect((await auth()) ? '/repos' : '/auth/login');
}

export const dynamic = 'force-dynamic';
