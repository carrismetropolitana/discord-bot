import { type CacheType, CommandInteraction, SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
	.setName('ajuda')
	.setDescription('Lista todos os comandos disponíveis.');

const execute = async (interaction: CommandInteraction<CacheType>) => {
	const cmds = await interaction.client.application?.commands.fetch();
	const reply = cmds.map(cmd => ('</' + cmd.name + ':' + cmd.id + '> - ' + cmd.description)).join('\n');
	await interaction.reply('## Ajuda\n' + reply);
};

export default {
	data,
	execute,
};
