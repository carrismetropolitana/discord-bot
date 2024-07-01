// Require the necessary discord.js classes
import { Client, GatewayIntentBits } from 'discord.js';
import { env } from 'process';

import { setupEvents } from './setupEvents';

// Create a new client instance
export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
setupEvents(client);
// Log in to Discord with your client's token
client.login(env.DISCORD_TOKEN);
