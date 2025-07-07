export interface Line {
	color: string
	facilities: []
	id: string
	locality_ids: (null | string)[]
	long_name: string
	municipality_ids: string[]
	pattern_ids: string[]
	region_ids: string[]
	route_ids: string[]
	short_name: string
	stop_ids: []
	text_color: string
	tts_name: string
};

async function getLines(): Promise<Line[]> {
	return (await fetch('https://api.carrismetropolitana.pt/v2/lines')).json();
}

export const lines = await getLines();
