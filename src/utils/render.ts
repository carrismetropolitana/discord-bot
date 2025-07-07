import StaticMaps from 'staticmaps';

interface Vehicle {
	bearing: number
	lat: number
	line_id?: string
	lon: number
	state?: string
}

interface Marker {
	coord: [number, number]
	height: number
	img: string
	offsetX: number
	offsetY: number
	width: number
}

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';

// generates a rotated version of the bus icon
async function rotateMarker(inputPath: string, angle: number) {
	angle = Math.round(angle / 5) * 5; // we're fine with just 5 degrees of variation. (i think)
	console.log(inputPath);
	if (fs.existsSync(inputPath + '_' + angle + '.png')) return inputPath + '_' + angle + '.png';
	const img = await loadImage(inputPath + '.png');
	const canvas = createCanvas(img.height, img.height);
	const ctx = canvas.getContext('2d');

	ctx.translate(canvas.width / 2, canvas.height / 2);
	ctx.rotate((angle * Math.PI) / 180);
	ctx.drawImage(img, -img.width / 2, -img.height / 2);

	fs.writeFileSync(inputPath + '_' + angle + '.png', canvas.toBuffer());
	return inputPath + '_' + angle + '.png';
}

const renderStopMap = async (lat: number, lon: number): Promise<Buffer> => {
	const options = {
		height: 600,
		tileUrl: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
		width: 800,
		zoom: 14,
	};
	const map = new StaticMaps(options);

	const marker: Marker = {
		coord: [lon, lat],
		height: 50,
		img: './assets/stop.png',
		offsetX: 25,
		offsetY: 50,
		width: 50,
	};

	map.addMarker(marker);
	await map.render([marker.coord[0], marker.coord[1]], 16);
	return map.image.buffer('image/png', { quality: 75 });
};

const renderVehicleMap = async (lat: number, lon: number, vehicles: Vehicle[], type: string) => {
	if (!type) type = 'LINES';
	const options = {
		height: 1200,
		tileUrl: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
		width: 1600,
		zoom: 20,
	};
	const map = new StaticMaps(options);

	await Promise.all(vehicles.map(async (vehicle: Vehicle) => {
		const path = await rotateMarker('./assets/bus-' + vehicle.state, vehicle.bearing);
		map.addMarker({
			coord: [vehicle.lon, vehicle.lat],
			height: 126,
			img: path,
			offsetX: 126 / 2,
			offsetY: 126 / 2,
			width: 126,
		});
	}));

	if (type !== 'VEHICLE') map.addMarker({ coord: [lon, lat], height: 16, img: './assets/stop.png', width: 16 });
	await map.render([lon, lat], 28);
	return map.image.buffer('image/png', { quality: 75 });
};

export default {
	renderStopMap,
	renderVehicleMap,
};
