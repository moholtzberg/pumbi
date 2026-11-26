export const RESERVED_HOUSE_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'auction-houses',
  'auctions',
  'dashboard',
  'email-preferences',
  'invites',
  'lots',
  'seller',
  'signup',
  'test-db',
  'assets',
  '_app',
]);
export const normalizeHouseSlug = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';
export function houseSlugProblem(value) {
  const slug = normalizeHouseSlug(value);
  if (!slug) return 'Slug is required';
  if (slug.length < 3 || slug.length > 50)
    return 'Slug must contain 3–50 characters';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return 'Use lowercase Latin letters, numbers, and single hyphens between words';
  if (RESERVED_HOUSE_SLUGS.has(slug))
    return 'This address is reserved by Pumbi. Choose a different slug';
  return null;
}
export function generateHouseSlug(name) {
  let slug = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  if (RESERVED_HOUSE_SLUGS.has(slug)) slug += '-house';
  return slug;
}
export const publicHousePath = (slug) =>
  `/${encodeURIComponent(normalizeHouseSlug(slug))}`;
