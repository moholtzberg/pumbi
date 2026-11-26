import { error, redirect } from '@sveltejs/kit';
import { houseSlugProblem, publicHousePath } from '$lib/utils/houseSlugs.js';
export function load({ params, url }) {
  if (houseSlugProblem(params.slug))
    throw error(404, 'Auction house not found');
  throw redirect(308, publicHousePath(params.slug) + url.search);
}
