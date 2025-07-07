import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type CacheType, CommandInteraction, InteractionContextType, type MessageActionRowComponentBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
	.setName('invite')
	.setDescription('Permite-te adicionar este bot ao teu servidor!')
	.setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel);

const execute = async (interaction: CommandInteraction<CacheType>) => {
	await interaction.reply({
		components: [
			new ActionRowBuilder<MessageActionRowComponentBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setLabel('Adicionar bot')
						.setURL('https://discord.com/oauth2/authorize?client_id=395958200353947660')
						.setStyle(ButtonStyle.Link),
				),
		],
		content: 'Clica no botão abaixo para adicionares este bot ao teu servidor!',
		flags: [MessageFlags.Ephemeral],
	});
};

export default {
	data,
	execute,
};
