// Use createRequire to import CommonJS Prisma Client in ES module context
import { createRequire } from 'module';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '$env/dynamic/private';

const require = createRequire(import.meta.url);

// Get DATABASE_URL from environment
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// CRITICAL: Set DATABASE_URL before importing Prisma
// Prisma reads this from process.env at module load time
process.env.DATABASE_URL = databaseUrl;

// Import Prisma Client using require (handles CommonJS)
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

function createPool() {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    // Neon/pgbouncer drop idle clients; recycle before they go stale.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000
  });

  pool.on('error', (err) => {
    console.error('Postgres pool error:', err.message);
  });

  return pool;
}

function isTransientConnectionError(err) {
  const message = String(err?.message ?? err ?? '');
  const code = err?.code;
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    message.includes('Connection terminated') ||
    message.includes('Connection ended unexpectedly') ||
    message.includes('Client has encountered a connection error') ||
    message.includes('the database system is starting up')
  );
}

function withTransientRetry(client) {
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (err) {
          if (!isTransientConnectionError(err)) {
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          return query(args);
        }
      }
    }
  });
}

function createPrismaClient() {
  const pool = createPool();
  const adapter = new PrismaPg(pool, {
    onPoolError: (err) => {
      console.error('Postgres pool error:', err.message);
    },
    onConnectionError: (err) => {
      console.error('Postgres connection error:', err.message);
    }
  });
  return withTransientRetry(new PrismaClient({ adapter }));
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
