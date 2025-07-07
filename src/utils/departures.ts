import { getVehicles } from './vehicles';

interface Arrival {
	estimated_arrival: string
	estimated_arrival_unix: number
	headsign: string
	line_id: string
	observed_arrival: string
	observed_arrival_unix: number
	pattern_id: string
	route_id: string
	scheduled_arrival: string
	scheduled_arrival_unix: number
	stop_sequence: number
	trip_id: string
	vehicle_id: string
}

export async function getArrivals(stopId: string): Promise<string> {
	let arrivals: Arrival[] = (await fetch('https://api.carrismetropolitana.pt/v2/arrivals/by_stop/' + stopId).then(r => r.json()));
	const now = Date.now() / 1000;
	arrivals = arrivals.filter(a => (a.scheduled_arrival_unix > now || a.estimated_arrival_unix > now) && !a.observed_arrival_unix);
	arrivals = arrivals.slice(0, 10);
	const vehicles = await getVehicles();
	if (arrivals.length === 0) return '*Sem serviço para este dia*';
	return arrivals.map(arrival =>
		('<t:' + (arrival.estimated_arrival_unix || arrival.scheduled_arrival_unix) + ':R> ' + arrival.line_id + ' ' + arrival.headsign + ' ' + (arrival.stop_sequence === 1 ? '**(PARTIDA)**' : '') + '\n-# **Veículo:** ' + (arrival.vehicle_id ? ('`' + arrival.vehicle_id + '` ' + vehicles.find(v => v.id === arrival.vehicle_id)?.make + ' ' + vehicles.find(v => v.id === arrival.vehicle_id)?.model) : 'Sem veículo atribuido'))).join('\n');
}
