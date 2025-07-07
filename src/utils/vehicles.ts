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

export async function getVehicles(): Promise<Vehicle[]> {
	return (await fetch('https://api.carrismetropolitana.pt/v2/vehicles')).json();
}
