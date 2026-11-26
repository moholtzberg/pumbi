import { json, error } from '@sveltejs/kit';
import { requireAuthenticatedUser } from '$lib/server/authorization.js';
import { addressBook, saveUserAddress, deleteUserAddress } from '$lib/server/userAddresses.js';
import prisma from '$lib/prisma.js';
const reply = body => json(body, { headers: { 'cache-control': 'private, no-store' } });
export async function GET({ locals }) {
  return reply(await addressBook(await requireAuthenticatedUser(locals)));
}
export async function POST({ locals, request }) {
  const user = await requireAuthenticatedUser(locals);
  const input = await request.json().catch(() => { throw error(400, 'A JSON address is required'); });
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw error(400, 'A JSON address is required');
  await saveUserAddress(user, input);
  const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
  return reply(await addressBook(refreshed));
}
export async function DELETE({ locals, request }) {
  const user = await requireAuthenticatedUser(locals);
  const input = await request.json().catch(() => ({}));
  await deleteUserAddress(user, input?.id);
  const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
  return reply(await addressBook(refreshed));
}
