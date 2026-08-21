import { redirect } from '@sveltejs/kit';

/** Seller auction list lives at /seller */
export function load() {
  throw redirect(302, '/seller');
}
