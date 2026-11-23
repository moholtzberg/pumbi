import schema from '../../../prisma/schema.prisma?raw';
import { parseAdminSchema } from '$lib/utils/adminSchema.js';

export const adminModels = parseAdminSchema(schema);
export const adminModelMap = new Map(adminModels.map(model => [model.key, model]));
