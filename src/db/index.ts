import { Database } from 'bun:sqlite';

const db = new Database('db.sqlite', { create: true });
// Make table that will contain guild IDs, and the selected channel ID for each guild
db.exec('CREATE TABLE IF NOT EXISTS guilds (guild_id TEXT PRIMARY KEY, channel_id TEXT)');

// Make table for already sent out alerts
db.exec('CREATE TABLE IF NOT EXISTS alerts (alert_id TEXT PRIMARY KEY)');

export function setChannel(guildId: string, channelId: string) {
	db.query('INSERT OR REPLACE INTO guilds (guild_id, channel_id) VALUES (?, ?)').run(guildId, channelId);
}

export function getChannel(guildId: string) {
	return db.query<{ channel_id: string }, [string]>('SELECT channel_id FROM guilds WHERE guild_id = ?')
		.get(guildId)?.channel_id;
}

export function getChannels() {
	return db.query<{ channel_id: string }, []>('SELECT channel_id FROM guilds').all();
}

export function addSentAlert(alertId: string) {
	db.query('INSERT INTO alerts (alert_id) VALUES (?)').run(alertId);
}

export function getSentAlerts() {
	const alerts = db.query<{ alert_id: string }, []>('SELECT alert_id FROM alerts').all();
	return new Set(alerts.map(({ alert_id }) => alert_id));
}
