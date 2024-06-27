import { type CacheType, CommandInteraction, SlashCommandBuilder } from 'discord.js';

import { setChannel } from '../db';
import { alertToEmbed, lastAlerts } from '../feeder';

const data = new SlashCommandBuilder()
	.setName('aqui')
	.setDescription('Selecionar este canal como o canal de alertas');

const execute = async (interaction: CommandInteraction<CacheType>) => {
	const { channelId, guildId } = interaction;
	if (!guildId) {
		await interaction.reply({ content: 'Comando disponível apenas em servidores!', ephemeral: true });
		return;
	}
	setChannel(guildId, channelId);
	const embeds = lastAlerts.alerts.slice(0, 5).map(alertToEmbed);
	await interaction.reply({
		content: 'Canal selecionado, aqui estão os alertas mais recentes:',
		embeds,
	});
};

export default {
	data,
	execute,
};
