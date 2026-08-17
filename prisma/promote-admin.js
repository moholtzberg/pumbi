import 'dotenv/config';
import { createRequire } from 'node:module';
import { PrismaPg } from '@prisma/adapter-pg';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run admin:promote -- user@example.com');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

try {
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'PLATFORM_ADMIN', auctionHouseId: null },
    select: { id: true, email: true, role: true }
  });
  console.log(`Promoted ${user.email} to ${user.role}. Sign in again to refresh the session.`);
} finally {
  await prisma.$disconnect();
}
