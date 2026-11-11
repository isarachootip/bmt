import { getPrisma } from '@/lib/prisma';
import { ensureBootstrapped } from '@/services/bootstrap.service';

async function main(): Promise<void> {
  const prisma = await getPrisma();
  await ensureBootstrapped(prisma);
  const userCount = await prisma.user.count();
  const techCount = await prisma.technician.count();
  console.log(`Seed completed: ${userCount} users, ${techCount} technicians.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
