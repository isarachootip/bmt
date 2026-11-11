import { redirect } from 'next/navigation';
import { getSessionActor } from '@/lib/auth';

export default async function HomePage() {
  const actor = await getSessionActor();
  if (actor) {
    redirect('/dashboard');
  }
  redirect('/login');
}
