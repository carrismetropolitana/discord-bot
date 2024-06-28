import { AutocompleteInteraction, type CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import { favoriteLine, getFavoriteLinesForUser, unfavoriteLine } from '../db';
import { lines } from '../utils/lines';

// const parsedLines = lines.map(line => ({ name: line.short_name, value: line.id }));
// console.log(parsedLines);

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
	);

const execute = async (interaction: ChatInputCommandInteraction) => {
	const { guildId } = interaction;
	if (!guildId) {
		await interaction.reply({ content: 'Comando disponível apenas em servidores!', ephemeral: true });
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
	const addOrRemove = interaction.options.getSubcommand();
	if (addOrRemove === 'add') {
		favoriteLine(interaction.user.id, guildId, line);
		await interaction.reply({ content: 'Linha adicionada como favorita!', ephemeral: true });
	}
	else {
		const { deleted } = unfavoriteLine(interaction.user.id, guildId, line);
		if (deleted) {
			await interaction.reply({ content: 'Linha removida como favorita!', ephemeral: true });
		}
		else {
			await interaction.reply({ content: 'Linha não estava como favorita!', ephemeral: true });
		}
	}
	console.log(addOrRemove, line);
};

const autocomplete = async (interaction: AutocompleteInteraction<CacheType>) => {
	const focusedValue = interaction.options.getFocused();
	const cmd = interaction.options.getSubcommand();
	if (cmd === 'add') {
		const filtered = lines.filter(line => line.short_name.toLowerCase().startsWith(focusedValue.toLowerCase())).slice(0, 25);
		await interaction.respond(
			filtered.map(line => ({ name: `${line.short_name} - ${line.long_name}`, value: line.id })),
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
			filtered.map(line => ({ name: `${line.short_name} - ${line.long_name}`, value: line.id })),
		);
	}
};

export default {
	autocomplete,
	data,
	execute,
};