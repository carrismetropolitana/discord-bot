import { z } from 'zod';

import { fetchJson } from './api';
import { stripOperatorPrefix } from './ids';

const patternsSchema = z.array(z.object({
	headsign: z.string().min(1),
}));

export async function getHeadsign(patternId: string): Promise<string> {
	const id = encodeURIComponent(stripOperatorPrefix(patternId));
	const patterns = await fetchJson(`https://api.carrismetropolitana.pt/v2/patterns/${id}`, patternsSchema);
	return patterns[0]?.headsign || 'N/A';
}
