import { RESTJSONErrorCodes } from 'discord-api-types/v10';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, DiscordAPIError, MediaGalleryBuilder, MediaGalleryItemBuilder, type MessageActionRowComponentBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';
import { ZodError } from 'zod';

import type { Alert } from './alerts';

import { client } from '..';
import { addSentAlert, baselineV2Alerts, deleteChannel, getChannelsAndGuilds, getFavoritedForLineIds, getSentAlerts } from '../db';
import log from '../utils/logging';
import { alertsSchema } from './alerts';

const INTERVAL = 1000 * 60 * 1;
export const lastAlerts: { alerts: Alert[] } = { alerts: [] };
let pollInProgress = false;
let lastPollError: null | string = null;

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
	const alertJson: unknown = await res.json();
	return alertsSchema.parse(alertJson);
}

async function sendNewAlerts() {
	const alerts = await getNewAlerts();
	for (const alert of alerts) {
		log.info('Broadcasting alert', alert._id);
		const delivered = await broadcastAlert(alert);
		if (delivered) {
			addSentAlert(alert._id);
		}
		else {
			log.warn('Broadcast incomplete, will retry alert', alert._id);
		}
	}
}

async function getNewAlerts() {
	const alerts = await getAlerts();
	if (baselineV2Alerts(alerts.map(({ _id }) => _id))) {
		log.info('Baselined current alerts after the v2 API schema migration', alerts.length);
		lastAlerts.alerts = alerts.sort((a, b) => b.active_period_start_date - a.active_period_start_date);
		return [];
	}
	const sentAlerts = getSentAlerts();

	const newAlerts = alerts.filter(({ _id }) => !sentAlerts.has(_id));
	const sortedAlerts = alerts.sort((a, b) => b.active_period_start_date - a.active_period_start_date);
	lastAlerts.alerts = sortedAlerts;
	return newAlerts;
}

function formatPollError(error: unknown) {
	if (error instanceof ZodError) {
		const issues = error.issues.slice(0, 3).map(issue => `${issue.path.join('.') || 'response'}: ${issue.message}`);
		const remainder = error.issues.length - issues.length;
		return `Invalid alerts API response: ${issues.join('; ')}${remainder > 0 ? `; and ${remainder} more issue(s)` : ''}`;
	}

	return error instanceof Error ? error.message : String(error);
}

async function pollAlerts() {
	if (pollInProgress) return;

	pollInProgress = true;
	try {
		await sendNewAlerts();
		if (lastPollError) {
			log.success('Alerts feed recovered after validation or fetch failure');
			lastPollError = null;
		}
	}
	catch (error) {
		const message = formatPollError(error);
		if (message !== lastPollError) {
			log.error(message);
			lastPollError = message;
		}
	}
	finally {
		pollInProgress = false;
	}
}

export async function setupFeed() {
	await pollAlerts();
	setInterval(() => void pollAlerts(), INTERVAL);
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
	const favsByGuild: Record<string, string[]> = {};
	if (alert.reference_type === 'lines') {
		const lineIds = alert.references.map(({ parent_id }) => {
			const prefixEnd = parent_id.lastIndexOf(']');
			return prefixEnd >= 0 ? parent_id.slice(prefixEnd + 1) : parent_id;
		});
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
		log.warn('No configured channels to broadcast alert', alert._id);
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
	const url = alert.info_url || `https://carrismetropolitana.pt/alerts/${alert._id}`;
	const container = new ContainerBuilder()
		.setAccentColor(0xffdd00)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent('### ' + alert.title + '\n' + alert.description),
		);
	if (alert.image_url) container.addMediaGalleryComponents(
		new MediaGalleryBuilder()
			.addItems(
				new MediaGalleryItemBuilder()
					.setURL(alert.image_url),
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
