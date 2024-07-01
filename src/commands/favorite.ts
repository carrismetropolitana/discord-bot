import { AutocompleteInteraction, type CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import { favoriteLine, getFavoriteLinesForUser, unfavoriteLine } from '../db';
import { type Line, lines } from '../utils/lines';

const data = new SlashCommandBuilder()
	.setName('fav')
	.setDescription('Adicionar ou remover uma linha como favorita, de modo a receber pings em alertas da mesma.')
	.addSubcommand(subcommand =>
		subcommand
			.setName('add')
			.setDescription('Adicionar uma linha como favorita')
			.addStringOption(option =>
				option
					.setName('linha')
					.setDescription('Nome da linha')
					.setRequired(true)
					.setAutocomplete(true),
			),
	).addSubcommand(subcommand =>
		subcommand
			.setName('rem')
			.setDescription('Remover uma linha como favorita')
			.addStringOption(option =>
				option
					.setName('linha')
					.setDescription('Nome da linha')
					.setRequired(true)
					.setAutocomplete(true),
			),
	).addSubcommand(subcommand =>
		subcommand
			.setName('list')
			.setDescription('Listar linhas favoritas'),
	);

const execute = async (interaction: ChatInputCommandInteraction) => {
	const { guildId } = interaction;
	if (!guildId) {
		await interaction.reply({ content: 'Comando disponível apenas em servidores!', ephemeral: true });
		return;
	}
	const subCommand = interaction.options.getSubcommand();
	if (subCommand === 'list') {
		const userLines = getFavoriteLinesForUser(interaction.user.id, guildId);
		const niceLines = userLines.map(line => lines.find(l => l.id === line)).filter(l => l != undefined);
		if (niceLines.length === 0) {
			await interaction.reply({ content: 'Não tem linhas favoritas!', ephemeral: true });
			return;
		}
		const replyString = niceLines.map(line => `\`${line.short_name} - ${line.long_name}\``).join('\n');

		await interaction.reply({ content: replyString.slice(0, 2000), ephemeral: true });
		return;
	}

	let line = interaction.options.getString('linha');
	if (!line) {
		await interaction.reply({ content: 'Erro ao processar linha', ephemeral: true });
		return;
	}
	if (line?.includes(' - ')) {
		line = line.split(' - ')[0];
	}
	if (subCommand === 'add') {
		const { alreadyHad } = favoriteLine(interaction.user.id, guildId, line);
		if (!alreadyHad)
			await interaction.reply({ content: 'Linha adicionada como favorita!', ephemeral: true });
		else
			await interaction.reply({ content: 'Linha já estava como favorita!', ephemeral: true });
	}
	else if (subCommand === 'rem') {
		const { deleted } = unfavoriteLine(interaction.user.id, guildId, line);
		if (deleted) {
			await interaction.reply({ content: 'Linha removida como favorita!', ephemeral: true });
		}
		else {
			await interaction.reply({ content: 'Linha não estava como favorita!', ephemeral: true });
		}
	}
};
function linesToAutocompleteOption(lines: Line[]) {
	return lines.map(line => ({ name: `${line.short_name} - ${line.long_name}`.slice(0, 100), value: line.id }));
}

const autocomplete = async (interaction: AutocompleteInteraction<CacheType>) => {
	const focusedValue = interaction.options.getFocused();
	const cmd = interaction.options.getSubcommand();
	if (cmd === 'add') {
		const filtered = lines.filter(line => line.short_name.toLowerCase().startsWith(focusedValue.toLowerCase())).slice(0, 25);
		await interaction.respond(
			linesToAutocompleteOption(filtered),
		);
	}
	else {
		const { guildId } = interaction;
		if (!guildId) {
			interaction.respond([]);
			return;
		}
		const userLines = getFavoriteLinesForUser(interaction.user.id, guildId);
		const niceLines = userLines.map(line => lines.find(l => l.id === line)).filter(l => l != undefined);
		const filtered = niceLines.filter(line => line.short_name.toLowerCase().startsWith(focusedValue.toLowerCase())).slice(0, 25);
		await interaction.respond(
			linesToAutocompleteOption(filtered),
		);
	}
};

export default {
	autocomplete,
	data,
	execute,
};
