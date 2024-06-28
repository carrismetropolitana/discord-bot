export interface Line {
	color: string
	facilities: []
	id: string
	localities: (null | string)[]
	long_name: string
	municipalities: string[]
	patterns: string[]
	routes: string[]
	short_name: string
	text_color: string
};

async function getLines(): Promise<Line[]> {
	return (await fetch('https://api.carrismetropolitana.pt/lines')).json();
}

export const lines = await getLines();
