import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';

export async function requirePlatformAdmin(locals) {
  const session = await locals.auth?.();
  const sessionUser = session?.user;

  if (!sessionUser) {
    throw error(401, 'Authentication required');
  }

  const user = await prisma.user.findFirst({
    where: sessionUser.id ? { id: sessionUser.id } : { email: sessionUser.email },
    select: { id: true, email: true, name: true, role: true }
  });

  if (!user || user.role !== 'PLATFORM_ADMIN') {
    throw error(403, 'Platform administrator access required');
  }

  return user;
}

export function adminError(err, fallback) {
  if (err?.status) throw err;
  if (err?.code === 'P2002') throw error(409, 'A record with these values already exists');
  console.error(fallback, err);
  throw error(500, fallback);
}
