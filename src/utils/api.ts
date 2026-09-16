import { z } from 'zod';

export async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Request to ${url} failed with ${response.status} ${response.statusText}`);
	}

	const payload: unknown = await response.json();
	return schema.parse(payload);
}
