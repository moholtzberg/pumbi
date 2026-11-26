import { loadAdminInventory } from '$lib/server/adminInventory.js';
export const load = event => loadAdminInventory('lot', event);
