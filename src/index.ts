// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { env } from 'process';

import { setupFeed } from './feeder';
import setupCommands from './setupCommands';
import log from './utils/logging';

// Create a new client instance
export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
	log.success(`Logged in as ${readyClient.user.tag}`);
	const guilds = readyClient.guilds.cache.map(guild => guild.name);
	log.info(`In guilds: ${guilds.join(', ')}`);
	setupCommands(client);
	setupFeed();
});
client.on(Events.GuildCreate, (guild) => {
	log.info(`Joined: ${guild.name}`);
});
client.on(Events.GuildDelete, (guild) => {
	log.info(`Left: ${guild.name}`);
});

// Log in to Discord with your client's token
client.login(env.DISCORD_TOKEN);
