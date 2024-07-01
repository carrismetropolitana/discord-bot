import { type Client, Events } from 'discord.js';

import { deleteGuild, getChannelsAndGuilds } from './db';
import { setupFeed } from './feeder';
import setupCommands from './setupCommands';
import log from './utils/logging';

export function setupEvents(client: Client) {
	client.once(Events.ClientReady, (readyClient) => {
		log.success(`Logged in as ${readyClient.user.tag}`);
		const guilds = readyClient.guilds.cache.map(guild => guild.name);

		const savedGuilds = getChannelsAndGuilds().map(({ guild_id }) => guild_id);

		// Yes its """slow""", if it ever becomes an issue I'll fix it
		const diffIds = savedGuilds.filter(guild => !readyClient.guilds.cache.map(g => g.id).includes(guild));
		for (const guildIds of diffIds) {
			deleteGuild(guildIds);
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
}
