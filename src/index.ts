// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { env } from 'process';

import { setupFeed } from './feeder';
import setupCommands from './setupCommands';

// Create a new client instance
export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
setupCommands(client);
setupFeed();
client.login(env.DISCORD_TOKEN);
