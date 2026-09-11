export interface Vehicle {
	agency_id: string
	bearing: number
	bikes_allowed?: string
	block_id: string
	capacity_seated?: number
	capacity_standing?: number
	capacity_total?: number
	current_status?: string
	door_status?: string
	event_id?: string
	id: string
	lat: number
	license_plate?: string
	line_id: string
	lon: number
	make?: string
	model?: string
	owner?: string
	pattern_id: string
	propulsion?: string
	registration_date?: string
	route_id: string
	schedule_relationship: string
	shift_id: string
	speed: number
	state?: string
	stop_id: string
	timestamp: number
	trip_id: string
	wheelchair_accessible?: string
};

// The API switched `timestamp` from seconds to milliseconds; accept either so the
// rest of the bot can keep treating it as unix seconds. 1e11 seconds is the year
// 5138, so anything above it is milliseconds.
function toUnixSeconds(timestamp: number): number {
	if (!timestamp) return timestamp;
	return timestamp > 1e11 ? Math.floor(timestamp / 1000) : timestamp;
}

// make, model and license_plate are null fleet-wide on the current API, so every
// label built from them has to drop the missing parts rather than print "null".
export function describeVehicle(vehicle: Pick<Vehicle, 'make' | 'model'>): string {
	return [vehicle.make, vehicle.model].filter(Boolean).join(' ');
}

async function fetchVehicles(): Promise<Vehicle[]> {
	const vehicles: Vehicle[] = await (await fetch('https://api.carrismetropolitana.pt/v2/vehicles')).json();
	return vehicles.map(vehicle => ({ ...vehicle, timestamp: toUnixSeconds(vehicle.timestamp) }));
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
