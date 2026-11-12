import { redirect } from 'next/navigation';
import LoginPage from '@/app/login/page';
import { getSessionActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const actor = await getSessionActor();
  if (actor) {
    redirect('/dashboard');
  }
  return <LoginPage />;
}
