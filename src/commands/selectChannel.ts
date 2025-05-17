import { type CacheType, CommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { setChannel } from '../db';
import { alertToEmbed, lastAlerts } from '../feeder';

const data = new SlashCommandBuilder()
	.setName('aqui')
	.setDescription('Selecionar este canal como o canal de alertas')
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const execute = async (interaction: CommandInteraction<CacheType>) => {
	const { channelId, guildId } = interaction;
	if (!guildId) {
		await interaction.reply({ content: 'Comando disponível apenas em servidores!', flags: MessageFlags.Ephemeral });
		return;
	}
	setChannel(guildId, channelId);
	const embeds = lastAlerts.alerts.slice(0, 5).reverse().map(alertToEmbed);
	await interaction.reply({
		content: 'Canal selecionado, aqui estão os alertas mais recentes:',
		embeds,
	});
};

export default {
	data,
	execute,
};
