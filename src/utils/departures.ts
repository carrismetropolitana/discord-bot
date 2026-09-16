import { z } from 'zod';

import { normalizeVehicleId } from './ids';
import logging from './logging';
import { getVehicleName, getVehicles } from './vehicles';

const arrivalSchema = z.object({
	estimated_arrival: z.string().nullable(),
	estimated_arrival_unix: z.number().int().nullable(),
	headsign: z.string(),
	line_id: z.string(),
	observed_arrival: z.string().nullable(),
	observed_arrival_unix: z.number().int().nullable(),
	pattern_id: z.string(),
	route_id: z.string(),
	scheduled_arrival: z.string(),
	scheduled_arrival_unix: z.number().int(),
	stop_sequence: z.number().int().positive(),
	trip_id: z.string().nullable(),
	vehicle_id: z.string().nullable(),
});

const arrivalsSchema = z.array(arrivalSchema);

type Arrival = z.infer<typeof arrivalSchema>;

export async function getArrivals(stopId: string): Promise<string> {
	let arrivals: Arrival[] = [];
	try {
		const response = await fetch('https://api.carrismetropolitana.pt/v2/arrivals/by_stop/' + encodeURIComponent(stopId));

		if (!response.ok) return 'Falha ao efetuar pedido. Erro ' + response.status + ' `' + response.statusText + '`';

		const payload: unknown = await response.json();
		arrivals = arrivalsSchema.parse(payload);
	}
	catch (error) {
		logging.error('Falha no fetch das partidas: ' + error);
	}

	const now = Date.now() / 1000;
	arrivals = arrivals.filter(a => (a.scheduled_arrival_unix > now || (a.estimated_arrival_unix ?? 0) > now) && !a.observed_arrival_unix);
	arrivals = arrivals.slice(0, 10);
	const vehicles = await getVehicles();
	if (arrivals.length === 0) return '*Sem serviço para este dia*';
	return arrivals.map((arrival) => {
		let vehicleInfo = 'Sem veículo atribuido';
		if (arrival.vehicle_id) {
			const vehicleId = normalizeVehicleId(arrival.vehicle_id);
			const vehicle = vehicles.find(v => normalizeVehicleId(v.id) === vehicleId);
			const name = vehicle && getVehicleName(vehicle);
			vehicleInfo = '`' + vehicleId + '`' + (name ? ' ' + name : '');
		}
		return '<t:' + (arrival.estimated_arrival_unix || arrival.scheduled_arrival_unix) + ':R> ' + arrival.line_id + ' ' + arrival.headsign + ' ' + (arrival.stop_sequence === 1 ? '**(PARTIDA)**' : '') + '\n-# **Veículo:** ' + vehicleInfo;
	}).join('\n');
}
