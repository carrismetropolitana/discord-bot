export interface Stop {
	district_id: string
	facilities: []
	id: string
	lat: number
	line_ids: string[]
	locality_id: string
	lon: number
	long_name: string
	municipality_id: string
	operational_status: string
	pattern_ids: string[]
	region_id: string
	route_ids: string[]
	short_name: string
	tts_name: string
};

async function getStops(): Promise<Stop[]> {
	return (await fetch('https://api.carrismetropolitana.pt/v2/stops')).json();
}

export const stops = await getStops();
