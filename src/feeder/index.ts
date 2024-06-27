import { EmbedBuilder } from 'discord.js';

import { client } from '..';
import { transit_realtime } from '../.generated/gtfs';
import { addSentAlert, getChannels, getSentAlerts } from '../db';
import log from '../utils/logging';

const INTERVAL = 1000 * 60 * 1;
export const lastAlerts: { alerts: { al: transit_realtime.IAlert, id: string }[] } = { alerts: [] };

// https://api.carrismetropolitana.pt/alerts
export async function getAlerts() {
	const res = await fetch('https://api.carrismetropolitana.pt/alerts.pb', {
		headers: {
			'User-Agent': 'Carris Metropolitana Discord Bot',
		},
	});
	if (!res.ok) {
		throw new Error('Failed to fetch alerts');
	}
	const buffer = await res.arrayBuffer();
	const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
	return feed.entity;
}

async function sendNewAlerts() {
	const alerts = await getNewAlerts();
	for (const alert of alerts) {
		log.info('Broadcasting alert', alert.id);
		broadcastAlert(alert.al);
		addSentAlert(alert.id);
	}
}

async function getNewAlerts() {
	const alerts = await getAlerts();
	const sentAlerts = getSentAlerts();
	const newAlerts: { al: transit_realtime.IAlert, id: string }[] = [];
	for (const alert of alerts) {
		if (alert.alert != null && alert.alert != undefined) {
			if (!sentAlerts.has(alert.id)) {
				newAlerts.push({ al: alert.alert, id: alert.id });
			}
		}
	}
	const sortedAlerts = newAlerts.sort((a, b) => {
		if (!a.al.activePeriod || a.al.activePeriod.length === 0) return 1;
		if (!b.al.activePeriod || b.al.activePeriod.length === 0) return -1;
		if (a.al.activePeriod[0].start == b.al.activePeriod[0].start) return 0;
		return a.al.activePeriod[0].start > b.al.activePeriod[0].start ? -1 : 1;
	});
	lastAlerts.alerts = sortedAlerts;
	return newAlerts;
}

export async function setupFeed() {
	if ((await getAlerts()).length === 0) {
		await getNewAlerts();
	}
	await sendNewAlerts();
	setInterval(sendNewAlerts, INTERVAL);
}

async function broadcastAlert(alert: transit_realtime.IAlert) {
	getChannels().forEach(async ({ channel_id }) => {
		const channel = client.channels.cache.get(channel_id) || await client.channels.fetch(channel_id);
		if (!channel || !channel.isTextBased()) return;
		channel.send({ embeds: [alertToEmbed(alert)] });
	});
}

export function alertToEmbed(alert: transit_realtime.IAlert) {
	const url = alert.url?.translation?.find(t => t.language === 'pt')?.text;
	const imageUrl = alert.image?.localizedImage?.find(i => i.language === 'pt')?.url;
	const title = alert.headerText?.translation?.find(t => t.language === 'pt')?.text;
	const description = alert.descriptionText?.translation?.find(t => t.language === 'pt')?.text;
	return new EmbedBuilder()
		.setColor(0xffdd00)
		.setTitle(title || 'Alerta')
		.setURL(url || null)
		.setImage(imageUrl || null)
		.setDescription(description || null);
}
