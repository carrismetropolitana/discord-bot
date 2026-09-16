import { z } from 'zod';

import { fetchJson } from './api';

const stopSchema = z.object({
	id: z.string().min(1),
	lat: z.number(),
	line_ids: z.array(z.string()),
	lon: z.number(),
	long_name: z.string().min(1),
});

const stopsSchema = z.array(stopSchema);

export type Stop = z.infer<typeof stopSchema>;
export const stops = await fetchJson('https://api.carrismetropolitana.pt/v2/stops', stopsSchema);
