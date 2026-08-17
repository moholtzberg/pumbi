import { redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';

export async function load({ locals, url }) {
  const session = await locals.auth?.();

  if (!session?.user) {
    throw redirect(302, `/auth/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  const user = await prisma.user.findFirst({
    where: session.user.id ? { id: session.user.id } : { email: session.user.email },
    select: { id: true, email: true, name: true, role: true }
  });

  if (!user || user.role !== 'PLATFORM_ADMIN') {
    throw redirect(303, '/');
  }

  return { admin: user };
}
