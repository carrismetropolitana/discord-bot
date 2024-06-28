import { Database } from 'bun:sqlite';

const db = new Database('db.sqlite', { create: true });
// Make table that will contain guild IDs, and the selected channel ID for each guild
db.exec('CREATE TABLE IF NOT EXISTS guilds (guild_id TEXT PRIMARY KEY, channel_id TEXT)');

// Make table for already sent out alerts
db.exec('CREATE TABLE IF NOT EXISTS alerts (alert_id TEXT PRIMARY KEY)');

// Make table for favorite alerts to hold user_id, guild_id, alert_id
db.exec('CREATE TABLE IF NOT EXISTS favorites (user_id TEXT, guild_id TEXT, line_id TEXT, PRIMARY KEY (user_id, guild_id, line_id))');
// Add indexes for faster lookups
db.exec('CREATE INDEX IF NOT EXISTS line_id_index ON favorites (line_id)');

export function setChannel(guildId: string, channelId: string) {
	db.query('INSERT OR REPLACE INTO guilds (guild_id, channel_id) VALUES (?, ?)').run(guildId, channelId);
}

export function getChannel(guildId: string) {
	return db.query<{ channel_id: string }, [string]>('SELECT channel_id FROM guilds WHERE guild_id = ?')
		.get(guildId)?.channel_id;
}

export function getChannels() {
	return db.query<{ channel_id: string, guild_id: string }, []>('SELECT channel_id, guild_id FROM guilds').all();
}

export function addSentAlert(alertId: string) {
	db.query('INSERT INTO alerts (alert_id) VALUES (?)').run(alertId);
}

export function getSentAlerts() {
	const alerts = db.query<{ alert_id: string }, []>('SELECT alert_id FROM alerts').all();
	return new Set(alerts.map(({ alert_id }) => alert_id));
}

export function favoriteLine(userId: string, guildId: string, alertId: string) {
	db.query('INSERT INTO favorites (user_id, guild_id, alert_id) VALUES (?, ?, ?)').run(userId, guildId, alertId);
}

export function unfavoriteLine(userId: string, guildId: string, alertId: string) {
	const res = db.query('DELETE FROM favorites WHERE user_id = ? AND guild_id = ? AND alert_id = ?').run(userId, guildId, alertId);
	return { deleted: res.changes > 0 };
}

export function getFavoritedForLineIds(lineIds: string[]) {
	const alerts = db.query<{ guild_id: string, user_id: string }, string[]>('SELECT user_id, guild_id FROM favorites WHERE line_id IN (?)')
		.all(...lineIds);
	return alerts;
}

export function getFavoriteLinesForUser(userId: string, guildId: string) {
	const alerts = db.query<{ line_id: string }, [string, string]>('SELECT line_id FROM favorites WHERE user_id = ? AND guild_id = ?')
		.all(userId, guildId);
	return alerts.map(({ line_id }) => line_id);
}
