import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

export interface EmbeddedPgHandle {
  prisma: PrismaClient;
  pglite: PGlite;
  stop: () => Promise<void>;
}

const globalForPrisma = globalThis as unknown as {
  bmtPrisma?: PrismaClient;
  bmtPrismaReady?: Promise<PrismaClient>;
};

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('Unable to allocate local TCP port')));
      }
    });
    srv.on('error', reject);
  });
}

export async function createEmbeddedPostgresHandle(
  dataDir: string,
  fixedPort?: number,
): Promise<EmbeddedPgHandle> {
  const pglite = new PGlite(dataDir);
  await pglite.waitReady;

  const check = await pglite.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'
    ) AS "exists";`,
  );

  if (!check.rows[0]?.exists) {
    const sqlPath = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      '0001_init',
      'migration.sql',
    );
    const migrationSql = fs.readFileSync(sqlPath, 'utf8').replace(/^\uFEFF/, '');
    await pglite.exec(migrationSql);
  }

  const port = fixedPort ?? (await findFreePort());
  const socketServer = new PGLiteSocketServer({
    db: pglite,
    host: '127.0.0.1',
    port,
    maxConnections: 5,
  });
  await socketServer.start();

  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  return {
    prisma,
    pglite,
    stop: async () => {
      await prisma.$disconnect();
      await socketServer.stop();
      await pglite.close();
    },
  };
}

export async function getPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.bmtPrisma) {
    return globalForPrisma.bmtPrisma;
  }
  if (!globalForPrisma.bmtPrismaReady) {
    globalForPrisma.bmtPrismaReady = (async () => {
      if (process.env.USE_EXTERNAL_PG === 'true') {
        const client = new PrismaClient();
        globalForPrisma.bmtPrisma = client;
        return client;
      }
      const dataDir = path.join(process.cwd(), '.pgdata', 'dev');
      fs.mkdirSync(path.dirname(dataDir), { recursive: true });
      const handle = await createEmbeddedPostgresHandle(dataDir);
      globalForPrisma.bmtPrisma = handle.prisma;
      return handle.prisma;
    })();
  }
  return globalForPrisma.bmtPrismaReady;
}
