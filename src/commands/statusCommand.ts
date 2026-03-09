import { RESTJSONErrorCodes } from 'discord-api-types/v10';
import { type CacheType, CommandInteraction, DiscordAPIError, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { deleteChannel, getAlertCount, getChannelsAndGuilds, getFavoriteCountForGuild, getGuildChannelInfo, getLatestSentAlert } from '../db';
import { lastAlerts } from '../feeder';

const data = new SlashCommandBuilder()
	.setName('status')
	.setDescription('Mostra o estado atual da configuração e entrega de alertas neste servidor')
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	.setContexts(InteractionContextType.Guild);

function formatTimestamp(timestamp: string) {
	const parsed = Date.parse(timestamp.replace(' ', 'T') + 'Z');
	if (Number.isNaN(parsed)) {
		return timestamp;
	}

	return `<t:${Math.floor(parsed / 1000)}:F>`;
}

const execute = async (interaction: CommandInteraction<CacheType>) => {
	const { guildId } = interaction;
	if (!guildId) {
		await interaction.reply({ content: 'Comando disponível apenas em servidores!', flags: MessageFlags.Ephemeral });
		return;
	}

	const guildChannel = getGuildChannelInfo(guildId);
	const favoriteCount = getFavoriteCountForGuild(guildId);
	const totalConfiguredGuilds = getChannelsAndGuilds().length;
	const alertCount = getAlertCount();
	const latestAlert = getLatestSentAlert();

	let channelStatus = 'Não configurado';
	if (guildChannel) {
		channelStatus = `<#${guildChannel.channel_id}>`;
		try {
			const channel = interaction.client.channels.cache.get(guildChannel.channel_id) || await interaction.client.channels.fetch(guildChannel.channel_id);
			if (!channel) {
				deleteChannel(guildChannel.channel_id);
				channelStatus = 'Canal configurado já não existe';
			}
			else if (!channel.isSendable()) {
				deleteChannel(guildChannel.channel_id);
				channelStatus = 'Canal configurado sem permissões de envio';
			}
		}
		catch (error) {
			if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel) {
				deleteChannel(guildChannel.channel_id);
				channelStatus = 'Canal configurado já não existe';
			}
			else if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions) {
				deleteChannel(guildChannel.channel_id);
				channelStatus = 'Canal configurado sem permissões de envio';
			}
			else {
				channelStatus = `<#${guildChannel.channel_id}> (não foi possível validar agora)`;
			}
		}
	}

	const lines = [
		'## Estado do bot',
		`Canal de alertas: ${channelStatus}`,
		guildChannel ? `Canal atualizado em: ${formatTimestamp(guildChannel.updated_at)}` : null,
		`Favoritos neste servidor: ${favoriteCount}`,
		latestAlert ? `Último alerta registado: ${latestAlert.alert_id} em ${formatTimestamp(latestAlert.updated_at)}` : 'Último alerta registado: nenhum',
		`Alertas registados na base de dados: ${alertCount}`,
		`Alertas na cache atual: ${lastAlerts.alerts.length}`,
		`Servidores com canal configurado: ${totalConfiguredGuilds}`,
	];

	await interaction.reply({ content: lines.filter(Boolean).join('\n'), flags: MessageFlags.Ephemeral });
};

export default {
	data,
	execute,
};
