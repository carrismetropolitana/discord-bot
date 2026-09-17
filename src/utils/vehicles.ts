import { z } from 'zod';

import { fetchJson } from './api';

const vehicleSchema = z.object({
	bearing: z.number().nullable().transform(bearing => bearing ?? 0),
	capacity_seated: z.number().optional(),
	capacity_standing: z.number().optional(),
	capacity_total: z.number().optional(),
	id: z.string().min(1),
	lat: z.number(),
	license_plate: z.string().nullable().optional(),
	line_id: z.string(),
	lon: z.number(),
	make: z.string().nullable().optional(),
	model: z.string().nullable().optional(),
	pattern_id: z.string(),
	shift_id: z.string().nullable().optional(),
	state: z.string().optional(),
	stop_id: z.string().nullable(),
	timestamp: z.number().int().nonnegative().transform(toUnixSeconds),
});

const vehiclePositionSchema = z.object({
	agency_id: z.string().min(1),
	bearing: z.number().nullable(),
	created_at: z.number().int().nonnegative(),
	latitude: z.number(),
	longitude: z.number(),
	route_short_name: z.string().min(1),
	shape_id: z.string().min(1),
	stop_id: z.string().nullable(),
	vehicle_id: z.string().min(1),
});

const vehiclePositionsResponseSchema = z.object({
	data: z.array(vehiclePositionSchema),
});

const vehicleMetadataSchema = z.object({
	agency_id: z.string().min(1),
	license_plate: z.string(),
	make: z.string(),
	model: z.string(),
	vehicle_id: z.string().min(1),
});

const vehicleMetadataResponseSchema = z.union([
	z.array(vehicleMetadataSchema),
	z.object({ data: z.array(vehicleMetadataSchema).nullable().optional() }),
]).transform(response => Array.isArray(response) ? response : (response.data ?? []));

export type Vehicle = z.infer<typeof vehicleSchema>;
type VehicleMetadata = z.infer<typeof vehicleMetadataSchema>;

// GO timestamps are milliseconds; accept either unit so the rest of the bot can
// keep treating timestamps as unix seconds. 1e11 seconds is the year 5138, so
// anything above it is milliseconds.
function toUnixSeconds(timestamp: number): number {
	if (!timestamp) return timestamp;
	return timestamp > 1e11 ? Math.floor(timestamp / 1000) : timestamp;
}

const CARRIS_METROPOLITANA_AGENCY_IDS = new Set(['A2L1N', 'BNA17', 'LA77N', 'YA15B']);

async function fetchVehicles(): Promise<Vehicle[]> {
	const [positionsResponse, metadata] = await Promise.all([
		fetchJson('https://go.tmlmobilidade.pt/hub/api/v1/realtime/vehicles/positions', vehiclePositionsResponseSchema),
		getVehicleMetadata(),
	]);
	const vehicles = positionsResponse.data
		.filter(position => CARRIS_METROPOLITANA_AGENCY_IDS.has(position.agency_id))
		.map(position => vehicleSchema.parse({
			bearing: position.bearing,
			id: position.vehicle_id,
			lat: position.latitude,
			line_id: position.route_short_name,
			lon: position.longitude,
			pattern_id: position.shape_id,
			stop_id: position.stop_id,
			timestamp: position.created_at,
		}));
	const metadataByVehicleId = new Map(metadata.map(item => [getMetadataVehicleKey(item), item]));

	return vehicles.map((vehicle) => {
		const item = metadataByVehicleId.get(getRealtimeVehicleKey(vehicle.id));
		if (!item) return vehicle;
		return {
			...vehicle,
			license_plate: formatLicensePlate(item.license_plate) || vehicle.license_plate,
			make: item.make || vehicle.make,
			model: item.model || vehicle.model,
		};
	});
}

function getMetadataVehicleKey(item: VehicleMetadata): string {
	const separator = item.vehicle_id.indexOf('-');
	const vehicleNumber = separator >= 0 ? item.vehicle_id.slice(separator + 1) : item.vehicle_id;
	return `[${item.agency_id}]${vehicleNumber}`;
}

function getRealtimeVehicleKey(vehicleId: string): string {
	const agencyIds = [...vehicleId.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]);
	const agencyId = agencyIds.at(-1);
	if (agencyId) return `[${agencyId}]${vehicleId.replace(/^(?:\[[^\]]*\])+/, '')}`;
	return vehicleId;
}

function formatLicensePlate(licensePlate: string): string {
	return licensePlate.replace(/^(\w{2})(\w{2})(\w{2})$/, '$1-$2-$3');
}

export function getVehicleName(vehicle: Pick<Vehicle, 'make' | 'model'>): null | string {
	const name = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
	return name || null;
}

const VEHICLE_METADATA_TTL = 15 * 60_000;

let metadataCachedAt = 0;
let cachedMetadata: VehicleMetadata[] = [];
let metadataRequest: null | Promise<VehicleMetadata[]> = null;

async function getVehicleMetadata(): Promise<VehicleMetadata[]> {
	if (Date.now() - metadataCachedAt < VEHICLE_METADATA_TTL) return cachedMetadata;

	if (!metadataRequest) {
		metadataRequest = fetchJson('https://go.tmlmobilidade.pt/hub/api/v1/realtime/vehicles/metadata', vehicleMetadataResponseSchema)
			.then((metadata) => {
				cachedMetadata = metadata;
				metadataCachedAt = Date.now();
				return metadata;
			})
			.finally(() => {
				metadataRequest = null;
			});
	}

	try {
		return await metadataRequest;
	}
	catch {
		// Position data is still useful if the independent metadata feed is down.
		return cachedMetadata;
	}
}

// The whole fleet comes down in one request, and autocomplete asks for it on every
// keystroke, so hold it briefly. Kept well under the 5 minute threshold /veiculo
// reads `delay` off, so cache age can't mark a healthy vehicle as delayed, and long
// enough that the index rebuilds itself instead of needing a restart.
const VEHICLES_TTL = 30_000;

let cachedAt = 0;
let cached: null | Promise<Vehicle[]> = null;

export async function getVehicles(): Promise<Vehicle[]> {
	let request = cached;
	if (!request || Date.now() - cachedAt > VEHICLES_TTL) {
		cachedAt = Date.now();
		request = fetchVehicles();
		cached = request;
		// don't serve a failed request for the rest of the TTL
		request.catch(() => {
			if (cached === request) cached = null;
		});
	}
	// callers mutate `state` on what they get back, so hand out copies
	return (await request).map(vehicle => ({ ...vehicle }));
}
