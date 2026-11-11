import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { ensureBootstrapped } from '@/services/bootstrap.service';

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const prisma = await getPrisma();
  await ensureBootstrapped(prisma);
  const actor = await getSessionActor();
  if (!actor) {
    redirect('/login');
  }
  return <AppShell actor={actor}>{children}</AppShell>;
}
