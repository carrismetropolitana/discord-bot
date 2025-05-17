import { EmbedBuilder } from 'discord.js';

import type { Alert } from './alerts';

import { client } from '..';
import { addSentAlert, getChannelsAndGuilds, getFavoritedForLineIds, getSentAlerts } from '../db';
import log from '../utils/logging';

const INTERVAL = 1000 * 60 * 1;
export const lastAlerts: { alerts: Alert[] } = { alerts: [] };

// https://api.carrismetropolitana.pt/alerts
export async function getAlerts() {
	const res = await fetch('https://api.carrismetropolitana.pt/v2/alerts', {
		headers: {
			'User-Agent': 'Carris Metropolitana Discord Bot',
		},
	});
	if (!res.ok) {
		throw new Error('Failed to fetch alerts');
	}
	const alertJson: Alert[] = await res.json();
	return alertJson;
}

async function sendNewAlerts() {
	const alerts = await getNewAlerts();
	for (const alert of alerts) {
		log.info('Broadcasting alert', alert.alert_id);
		broadcastAlert(alert);
		addSentAlert(alert.alert_id);
	}
}

async function getNewAlerts() {
	const alerts = await getAlerts();
	const sentAlerts = getSentAlerts();

	const newAlerts = alerts.filter(({ alert_id }) => !sentAlerts.has(alert_id));
	const sortedAlerts = alerts.sort((a, b) => {
		if (!a.active_period || a.active_period.length === 0) return 1;
		if (!b.active_period || b.active_period.length === 0) return -1;
		if (a.active_period[0].start == b.active_period[0].start) return 0;
		return a.active_period[0].start > b.active_period[0].start ? -1 : 1;
	});
	lastAlerts.alerts = sortedAlerts;
	return newAlerts;
}

export async function setupFeed() {
	await getNewAlerts();
	await sendNewAlerts();
	setInterval(sendNewAlerts, INTERVAL);
}

async function broadcastAlert(alert: Alert) {
	const informedEntity = alert.informed_entity;
	const favsByGuild: Record<string, string[]> = {};
	if (informedEntity) {
		const goodRouteIds: string[] = [];
		const routeIds = informedEntity.map(e => e.route_id);
		for (const lineId of routeIds) {
			if (lineId) {
				goodRouteIds.push(lineId);
			}
		}
		const lineIds = goodRouteIds.filter(routeId => routeId != '').map(routeId => routeId.slice(0, 4));
		const favs = getFavoritedForLineIds(lineIds);
		for (const fav of favs) {
			if (!favsByGuild[fav.guild_id]) {
				favsByGuild[fav.guild_id] = [];
			}
			favsByGuild[fav.guild_id].push(fav.user_id);
		}
	}
	getChannelsAndGuilds().forEach(async ({ channel_id, guild_id }) => {
		try {
			const channel = client.channels.cache.get(channel_id) || await client.channels.fetch(channel_id);
			const users = favsByGuild[guild_id] || [];
			const usersSet = new Set(users);
			if (!channel || !channel.isSendable()) return;
			channel.send({ content: usersSet.size > 0 ? `<@${Array.from(usersSet.values()).join('>, <@')}>` : '', embeds: [alertToEmbed(alert)] });
		}
		catch (e) {
			log.error('Failed to send alert to channel', channel_id, guild_id, e);
		}
	});
}

export function alertToEmbed(alert: Alert) {
	const url = `https://carrismetropolitana.pt/alerts/${alert.alert_id}`;
	const imageUrl = alert.image?.localizedImage?.find(i => i.language === 'pt')?.url;
	const title = alert.header_text?.translation?.find(t => t.language === 'pt')?.text;
	const description = alert.description_text?.translation?.find(t => t.language === 'pt')?.text;
	return new EmbedBuilder()
		.setColor(0xffdd00)
		.setTitle(title || 'Alerta')
		.setURL(url)
		.setImage(imageUrl || null)
		.setDescription(description || null);
}
