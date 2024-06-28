import { type CacheType, CommandInteraction, SlashCommandBuilder } from 'discord.js';

export function makeHelpCommand(commands: [string, string][]) {
	const data = new SlashCommandBuilder()
		.setName('ajuda')
		.setDescription('Lista todos os comandos disponíveis.');

	const replyString = commands.map(command => `/${command[0]} - ${command[1]}`).join('\n');

	const execute = async (interaction: CommandInteraction<CacheType>) => {
		await interaction.reply(replyString);
	};

	return {
		data,
		execute,
	};
}
