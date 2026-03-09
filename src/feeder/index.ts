import { RESTJSONErrorCodes } from 'discord-api-types/v10';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, DiscordAPIError, MediaGalleryBuilder, MediaGalleryItemBuilder, type MessageActionRowComponentBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';

import type { Alert } from './alerts';

import { client } from '..';
import { addSentAlert, deleteChannel, getChannelsAndGuilds, getFavoritedForLineIds, getSentAlerts } from '../db';
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
		const delivered = await broadcastAlert(alert);
		if (delivered) {
			addSentAlert(alert.alert_id);
		}
		else {
			log.warn('Broadcast incomplete, will retry alert', alert.alert_id);
		}
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
	await sendNewAlerts();
	setInterval(sendNewAlerts, INTERVAL);
}

function isUnknownChannelError(error: unknown) {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel;
}

function isMissingPermissionsError(error: unknown) {
	return error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions;
}

function formatGuildLabel(guildId: string) {
	const guildName = client.guilds.cache.get(guildId)?.name;
	return guildName ? `${guildName} (${guildId})` : guildId;
}

function formatChannelLabel(channelId: string, guildId: string, channelName?: null | string) {
	if (channelName) {
		return `#${channelName} (${channelId}) in ${formatGuildLabel(guildId)}`;
	}

	const cachedChannel = client.channels.cache.get(channelId);
	if (cachedChannel && !cachedChannel.isDMBased() && 'name' in cachedChannel && typeof cachedChannel.name === 'string') {
		return `#${cachedChannel.name} (${channelId}) in ${formatGuildLabel(guildId)}`;
	}

	return `${channelId} in ${formatGuildLabel(guildId)}`;
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
	const channelsAndGuilds = getChannelsAndGuilds();
	if (channelsAndGuilds.length === 0) {
		log.warn('No configured channels to broadcast alert', alert.alert_id);
		return false;
	}
	const results = await Promise.all(channelsAndGuilds.map(async ({ channel_id, guild_id }) => {
		try {
			const channel = client.channels.cache.get(channel_id) || await client.channels.fetch(channel_id);
			const channelLabel = formatChannelLabel(channel_id, guild_id, channel && 'name' in channel ? channel.name : undefined);
			const users = favsByGuild[guild_id] || [];
			const usersSet = new Set(users);
			if (!channel) {
				deleteChannel(channel_id);
				log.info('Removed missing channel from database', channelLabel);
				return 'removed';
			}
			if (!channel.isSendable()) {
				deleteChannel(channel_id);
				log.warn('Removed channel without send permissions from database', channelLabel);
				return 'removed';
			}
			const components = [];
			if (usersSet.size > 0) {
				const users = new TextDisplayBuilder().setContent(`<@${Array.from(usersSet.values()).join('>, <@')}>`);
				const divider = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);
				components.push(users, divider);
			}
			components.push(alertToContainer(alert));
			await channel.send({
				components: components,
				flags: [MessageFlags.IsComponentsV2],
			});
			return 'sent';
		}
		catch (e) {
			if (isUnknownChannelError(e)) {
				deleteChannel(channel_id);
				log.info('Removed deleted channel from database', formatChannelLabel(channel_id, guild_id));
				return 'removed';
			}
			if (isMissingPermissionsError(e)) {
				deleteChannel(channel_id);
				log.warn('Removed channel without send permissions from database', formatChannelLabel(channel_id, guild_id));
				return 'removed';
			}
			log.error('Failed to send alert to channel', formatChannelLabel(channel_id, guild_id), e);
			return 'failed';
		}
	}));
	return results.every(result => result !== 'failed');
}

export function alertToContainer(alert: Alert) {
	const url = `https://carrismetropolitana.pt/alerts/${alert.alert_id}`;
	const imageUrl = alert.image?.localizedImage?.find(i => i.language === 'pt')?.url;
	const title = alert.header_text?.translation?.find(t => t.language === 'pt')?.text;
	const description = alert.description_text?.translation?.find(t => t.language === 'pt')?.text;
	const container = new ContainerBuilder()
		.setAccentColor(0xffdd00)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent('### ' + (title || 'Alerta') + '\n' + (description || null)),
		);
	if (imageUrl) container.addMediaGalleryComponents(
		new MediaGalleryBuilder()
			.addItems(
				new MediaGalleryItemBuilder()
					.setURL(imageUrl || ''),
			),
	);
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
	container.addActionRowComponents(
		new ActionRowBuilder<MessageActionRowComponentBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setLabel('Ver alerta')
					.setURL(url),
			),
	);
	return container;
}
