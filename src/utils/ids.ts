// The API prefixes GTFS ids with one or more opaque operator hashes, e.g.
// `[XS3H8][LA77N]1211_0_1`. The endpoints that take an id — and the /lines and
// /stops payloads — still use the bare form, so strip the prefixes before
// comparing ids across endpoints or building a request URL.
const OPERATOR_PREFIX = /^(?:\[[^\]]*\])+/;

export function stripOperatorPrefix(id: string): string {
	return id.replace(OPERATOR_PREFIX, '');
}

// Vehicle ids have been through `AGENCY_ID|VEHICLE_ID` and `[OPERATOR_HASH]VEHICLE_ID`
// on the way to the bare `VEHICLE_ID` the API returns today. Accept all three so a
// format change doesn't break matching again.
export function normalizeVehicleId(id: string): string {
	const bare = stripOperatorPrefix(id);
	return bare.slice(bare.indexOf('|') + 1);
}
