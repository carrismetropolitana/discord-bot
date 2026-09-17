import { Database } from 'bun:sqlite';

const db = new Database('db.sqlite', { create: true });
// Make table that will contain guild IDs, and the selected channel ID for each guild
db.exec('CREATE TABLE IF NOT EXISTS guilds (guild_id TEXT PRIMARY KEY, channel_id TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');

// Make table for already sent out alerts
db.exec('CREATE TABLE IF NOT EXISTS alerts (alert_id TEXT PRIMARY KEY NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');

const alertIdColumn = db.query<{ is_not_null: number }, []>('SELECT "notnull" AS is_not_null FROM pragma_table_info(\'alerts\') WHERE name = \'alert_id\'').get();
if (!alertIdColumn?.is_not_null) {
	const migrateAlerts = db.transaction(() => {
		db.exec('DROP TABLE IF EXISTS alerts_with_valid_ids');
		db.exec('CREATE TABLE alerts_with_valid_ids (alert_id TEXT PRIMARY KEY NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
		db.exec('INSERT OR IGNORE INTO alerts_with_valid_ids (alert_id, updated_at) SELECT alert_id, updated_at FROM alerts WHERE alert_id IS NOT NULL AND length(alert_id) > 0');
		db.exec('DROP TABLE alerts');
		db.exec('ALTER TABLE alerts_with_valid_ids RENAME TO alerts');
	});
	migrateAlerts();
}

// Make table for favorite alerts to hold user_id, guild_id, alert_id
db.exec('CREATE TABLE IF NOT EXISTS favorites (user_id TEXT, guild_id TEXT, line_id TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, guild_id, line_id))');
db.exec('CREATE TABLE IF NOT EXISTS migrations (migration_id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
// Add indexes for faster lookups
db.exec('CREATE INDEX IF NOT EXISTS line_id_index ON favorites (line_id)');

export function setChannel(guildId: string, channelId: string) {
	db.query('INSERT INTO guilds (guild_id, channel_id, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, updated_at = CURRENT_TIMESTAMP').run(guildId, channelId);
}

export function getChannel(guildId: string) {
	return db.query<{ channel_id: string }, [string]>('SELECT channel_id FROM guilds WHERE guild_id = ?')
		.get(guildId)?.channel_id;
}

export function getGuildChannelInfo(guildId: string) {
	return db.query<{ channel_id: string, updated_at: string }, [string]>('SELECT channel_id, updated_at FROM guilds WHERE guild_id = ?')
		.get(guildId);
}

export function deleteGuild(guildId: string) {
	db.query('DELETE FROM guilds WHERE guild_id = ?').run(guildId);
	db.query('DELETE FROM favorites WHERE guild_id = ?').run(guildId);
}

export function deleteChannel(channelId: string) {
	db.query('DELETE FROM guilds WHERE channel_id = ?').run(channelId);
}

export function getChannelsAndGuilds() {
	return db.query<{ channel_id: string, guild_id: string }, []>('SELECT channel_id, guild_id FROM guilds').all();
}

export function addSentAlert(alertId: string) {
	if (!alertId) {
		throw new Error('Cannot persist an alert without a valid ID');
	}

	db.query('INSERT INTO alerts (alert_id, updated_at) VALUES (?, CURRENT_TIMESTAMP) ON CONFLICT(alert_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP').run(alertId);
}

export function baselineV2Alerts(alertIds: string[]) {
	const baseline = db.transaction(() => {
		const migrationId = 'baseline-v2-alert-ids';
		const alreadyApplied = db.query<{ migration_id: string }, [string]>('SELECT migration_id FROM migrations WHERE migration_id = ?').get(migrationId);
		if (alreadyApplied) return false;

		const insertAlert = db.query('INSERT OR IGNORE INTO alerts (alert_id, updated_at) VALUES (?, CURRENT_TIMESTAMP)');
		for (const alertId of alertIds) {
			if (!alertId) {
				throw new Error('Cannot baseline an alert without a valid ID');
			}
			insertAlert.run(alertId);
		}

		db.query('INSERT INTO migrations (migration_id, applied_at) VALUES (?, CURRENT_TIMESTAMP)').run(migrationId);
		return true;
	});

	return baseline();
}

export function getSentAlerts() {
	const alerts = db.query<{ alert_id: string }, []>('SELECT alert_id FROM alerts').all();
	return new Set(alerts.map(({ alert_id }) => alert_id));
}

export function getLatestSentAlert() {
	return db.query<{ alert_id: string, updated_at: string }, []>('SELECT alert_id, updated_at FROM alerts ORDER BY updated_at DESC LIMIT 1').get();
}

export function getAlertCount() {
	return db.query<{ count: number }, []>('SELECT COUNT(*) as count FROM alerts').get()?.count || 0;
}

export function favoriteLine(userId: string, guildId: string, alertId: string) {
	const existing = db.query<{ user_id: string }, [string, string, string]>('SELECT user_id FROM favorites WHERE user_id = ? AND guild_id = ? AND line_id = ?')
		.get(userId, guildId, alertId);
	if (existing) {
		db.query('UPDATE favorites SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ? AND line_id = ?').run(userId, guildId, alertId);
		return { alreadyHad: true };
	}

	db.query('INSERT INTO favorites (user_id, guild_id, line_id, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').run(userId, guildId, alertId);
	return { alreadyHad: false };
}

export function unfavoriteLine(userId: string, guildId: string, alertId: string) {
	const res = db.query('DELETE FROM favorites WHERE user_id = ? AND guild_id = ? AND line_id = ?').run(userId, guildId, alertId);
	return { deleted: res.changes > 0 };
}

export function getFavoritedForLineIds(lineIds: string[]) {
	const sql = 'SELECT user_id, guild_id FROM favorites WHERE line_id IN (' + lineIds.map(() => '?').join(', ') + ')';
	const alerts = db.query<{ guild_id: string, user_id: string }, string[]>(sql)
		.all(...lineIds);
	return alerts;
}

export function getFavoriteLinesForUser(userId: string, guildId: string) {
	const alerts = db.query<{ line_id: string }, [string, string]>('SELECT line_id FROM favorites WHERE user_id = ? AND guild_id = ?')
		.all(userId, guildId);
	return alerts.map(({ line_id }) => line_id);
}

export function getFavoriteCountForGuild(guildId: string) {
	return db.query<{ count: number }, [string]>('SELECT COUNT(*) as count FROM favorites WHERE guild_id = ?')
		.get(guildId)?.count || 0;
}

export function cleanupStaleFavorites(validGuildIds: string[], validLineIds: string[]) {
	let deletedByGuild = 0;
	let deletedByLine = 0;

	if (validGuildIds.length === 0) {
		deletedByGuild = db.query('DELETE FROM favorites').run().changes;
		return { deleted: deletedByGuild, deletedByGuild, deletedByLine };
	}

	const guildSql = 'DELETE FROM favorites WHERE guild_id NOT IN (' + validGuildIds.map(() => '?').join(', ') + ')';
	deletedByGuild = db.query(guildSql).run(...validGuildIds).changes;

	if (validLineIds.length === 0) {
		deletedByLine = db.query('DELETE FROM favorites').run().changes;
		return { deleted: deletedByGuild + deletedByLine, deletedByGuild, deletedByLine };
	}

	const lineSql = 'DELETE FROM favorites WHERE line_id NOT IN (' + validLineIds.map(() => '?').join(', ') + ')';
	deletedByLine = db.query(lineSql).run(...validLineIds).changes;

	return { deleted: deletedByGuild + deletedByLine, deletedByGuild, deletedByLine };
}
