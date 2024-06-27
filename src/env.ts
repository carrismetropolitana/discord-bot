import { env } from 'process';

export const token = env.DISCORD_TOKEN || '';
export const clientId = env.CLIENT_ID || '';
