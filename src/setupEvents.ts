import { RESTJSONErrorCodes } from 'discord-api-types/v10';
import { type Client, DiscordAPIError, Events } from 'discord.js';

import { cleanupStaleFavorites, deleteChannel, deleteGuild, getChannelsAndGuilds } from './db';
import { setupFeed } from './feeder';
import setupCommands from './setupCommands';
import { lines } from './utils/lines';
import log from './utils/logging';

function formatGuildLabel(client: Client, guildId: string) {
	const guildName = client.guilds.cache.get(guildId)?.name;
	return guildName ? `${guildName} (${guildId})` : guildId;
}

function formatChannelLabel(client: Client, channelId: string, guildId: string, channelName?: null | string) {
	if (channelName) {
		return `#${channelName} (${channelId}) in ${formatGuildLabel(client, guildId)}`;
	}

	const cachedChannel = client.channels.cache.get(channelId);
	if (cachedChannel && !cachedChannel.isDMBased() && 'name' in cachedChannel && typeof cachedChannel.name === 'string') {
		return `#${cachedChannel.name} (${channelId}) in ${formatGuildLabel(client, guildId)}`;
	}

	return `${channelId} in ${formatGuildLabel(client, guildId)}`;
}

export function setupEvents(client: Client) {
	client.once(Events.ClientReady, async (readyClient) => {
		log.success(`Logged in as ${readyClient.user.tag}`);
		const guilds = readyClient.guilds.cache.map(guild => guild.name);
		const cachedGuildIds = new Set(readyClient.guilds.cache.map(guild => guild.id));
		const savedChannels = getChannelsAndGuilds();

		const savedGuilds = savedChannels.map(({ guild_id }) => guild_id);

		// Yes its """slow""", if it ever becomes an issue I'll fix it
		const diffIds = savedGuilds.filter(guild => !cachedGuildIds.has(guild));
		for (const guildIds of diffIds) {
			deleteGuild(guildIds);
		}

		const favoriteCleanup = cleanupStaleFavorites(Array.from(cachedGuildIds), lines.map(line => line.id));
		if (favoriteCleanup.deleted > 0) {
			log.info('Removed stale favorites', favoriteCleanup.deleted, `(guilds: ${favoriteCleanup.deletedByGuild}, lines: ${favoriteCleanup.deletedByLine})`);
		}

		for (const { channel_id, guild_id } of savedChannels) {
			if (!cachedGuildIds.has(guild_id)) {
				continue;
			}
			try {
				const channel = readyClient.channels.cache.get(channel_id) || await readyClient.channels.fetch(channel_id);
				const channelLabel = formatChannelLabel(readyClient, channel_id, guild_id, channel && 'name' in channel ? channel.name : undefined);
				if (!channel) {
					deleteChannel(channel_id);
					log.info('Removed missing saved channel', channelLabel);
				}
				else if (!channel.isSendable()) {
					deleteChannel(channel_id);
					log.warn('Removed saved channel without send permissions from database', channelLabel);
				}
			}
			catch (e) {
				if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.UnknownChannel) {
					deleteChannel(channel_id);
					log.info('Removed stale deleted channel from database', formatChannelLabel(readyClient, channel_id, guild_id));
					continue;
				}
				if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.MissingPermissions) {
					deleteChannel(channel_id);
					log.warn('Removed saved channel without send permissions from database', formatChannelLabel(readyClient, channel_id, guild_id));
					continue;
				}
				log.error('Failed to validate saved channel', formatChannelLabel(readyClient, channel_id, guild_id), e);
			}
		}

		log.info(`In ${guilds.length} guilds: ${guilds.join(', ')}`);
		setupCommands(readyClient);
		setupFeed();
	});
	client.on(Events.GuildCreate, (guild) => {
		log.info(`Joined: ${guild.name}`);
		try {
			const channel = guild.systemChannel || guild.channels.cache.find(channel => channel.isTextBased());
			channel?.send('Olá! Eu sou o bot da Carris Metropolitana. Use `/ajuda` para ler os comandos disponíveis.');
		}
		catch (e) {
			log.error('Failed to send hello message to default channel in', guild.name, e);
		}
	});
	client.on(Events.GuildDelete, (guild) => {
		deleteGuild(guild.id);
		log.info(`Left: ${guild.name}`);
	});
	client.on(Events.ChannelDelete, (channel) => {
		if (!channel.isDMBased()) {
			deleteChannel(channel.id);
			log.info(`Channel deleted: ${channel.name} (${channel.id})`);
		}
	});
}
