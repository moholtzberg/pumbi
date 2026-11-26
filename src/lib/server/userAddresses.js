import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { formatAddress, shippingDefaults } from '$lib/utils/addresses.js';
export async function addressBook(user, client = prisma) {
  const addresses = await client.userAddress.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] });
  return { addresses, profileAddress: addresses.length ? formatAddress(addresses[0]) : user.address || '', defaultShippingAddress: shippingDefaults(user, addresses).address };
}
function addressData(input) {
  if (input.id != null && (typeof input.id !== 'string' || !input.id.trim())) throw error(400, 'Choose an address');
  const data = {};
  for (const [key, limit] of [['label',80],['name',160],['street1',200],['street2',200],['city',120],['state',120],['zip',30],['country',2],['phone',50]]) {
    if (input[key] != null && typeof input[key] !== 'string') throw error(400, `${key} must be text`);
    const value = (input[key] || '').trim();
    if (value.length > limit) throw error(400, `${key} is too long`);
    data[key] = value || null;
  }
  if (!data.label || !data.street1 || !data.city || !/^[A-Za-z]{2}$/.test(data.country || '')) throw error(400, 'Label, street, city, and a two-letter country code are required');
  data.country = data.country.toUpperCase();
  if (typeof input.isDefault !== 'boolean') throw error(400, 'Choose whether this is your default address');
  return data;
}
export async function saveUserAddress(user, input, client = prisma) {
  const data = addressData(input);
  return client.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id} FOR UPDATE`;
    const existing = input.id ? await tx.userAddress.findFirst({ where: { id: input.id, userId: user.id } }) : null;
    if (input.id && !existing) throw error(404, 'Address not found');
    const primary = await tx.userAddress.findFirst({ where: { userId: user.id, isDefault: true } });
    const makeDefault = input.isDefault || existing?.isDefault || !primary;
    if (makeDefault) await tx.userAddress.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
    const address = existing ? await tx.userAddress.update({ where: { id: existing.id }, data: { ...data, isDefault: makeDefault } }) : await tx.userAddress.create({ data: { ...data, userId: user.id, isDefault: makeDefault } });
    if (makeDefault) await tx.user.update({ where: { id: user.id }, data: { address: formatAddress(address) } });
    return address;
  });
}
export async function deleteUserAddress(user, id, client = prisma) {
  if (typeof id !== 'string' || !id) throw error(400, 'Choose an address');
  await client.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id} FOR UPDATE`;
    const existing = await tx.userAddress.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw error(404, 'Address not found');
    await tx.userAddress.delete({ where: { id: existing.id } });
    if (existing.isDefault) {
      const next = await tx.userAddress.findFirst({ where: { userId: user.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      if (next) await tx.userAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      await tx.user.update({ where: { id: user.id }, data: { address: next ? formatAddress(next) : null } });
    }
  });
}
