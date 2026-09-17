import { z } from 'zod';

const alertReferenceSchema = z.object({
	child_ids: z.array(z.string()),
	parent_id: z.string().min(1),
});

export const alertsSchema = z.array(z.object({
	_id: z.string().trim().min(1),
	active_period_end_date: z.number().int().nonnegative().nullable(),
	active_period_start_date: z.number().int().nonnegative(),
	description: z.string(),
	image_url: z.string().url().nullable(),
	info_url: z.string().url().nullable(),
	reference_type: z.enum(['lines', 'stops']),
	references: z.array(alertReferenceSchema),
	title: z.string().min(1),
}));

export type Alert = z.infer<typeof alertsSchema>[number];
