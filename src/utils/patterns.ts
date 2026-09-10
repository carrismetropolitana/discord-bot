import { stripOperatorPrefix } from './ids';

export async function getHeadsign(patternId: string): Promise<string> {
	// /patterns only resolves bare ids; a prefixed one answers with `{}`.
	const pattern = await fetch('https://api.cmet.pt/patterns/' + stripOperatorPrefix(patternId)).then(r => r.json());
	if (!Array.isArray(pattern) || pattern.length < 1 || !pattern[0].headsign) return 'N/A';
	return pattern[0].headsign;
}
