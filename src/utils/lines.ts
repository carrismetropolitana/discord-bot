import { z } from 'zod';

import { fetchJson } from './api';

const lineSchema = z.object({
	id: z.string().min(1),
	long_name: z.string().min(1),
	pattern_ids: z.array(z.string()),
	short_name: z.string().min(1),
});

const linesSchema = z.array(lineSchema);

export type Line = z.infer<typeof lineSchema>;

export const lines = await fetchJson('https://api.carrismetropolitana.pt/v2/lines', linesSchema);
