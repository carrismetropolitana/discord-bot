/* eslint-disable perfectionist/sort-imports */
import { AutocompleteInteraction, type CacheType, ChatInputCommandInteraction, type Client, Events, MessageFlags, REST, Routes, SeparatorBuilder, SeparatorSpacingSize, SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder, type SlashCommandSubcommandsOnlyBuilder, TextDisplayBuilder } from 'discord.js';

import favorite from './commands/favoriteCommand';
import help from './commands/helpCommand';
import invite from './commands/inviteCommand';
import selectChannel from './commands/selectChannelCommand';
import { clientId, token } from './env';
import log from './utils/logging';
import stopCommand from './commands/stopCommand';
import vehicleCommand from './commands/vehicleCommand';
import { getArrivals } from './utils/departures';

const rawCommands: {
	autocomplete?: (interaction: AutocompleteInteraction<CacheType>) => Promise<unknown>
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder
	execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>
}[] = [
	help,
	selectChannel,
	favorite,
	invite,
	stopCommand,
	vehicleCommand,
];

const commands = Object.fromEntries(rawCommands.map(command => [command.data.name, command]));
const updateCommands = rawCommands.map(command => command.data.toJSON());

export default function setupCommands(client: Client<true>) {
	// Slash interactions
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand()) return;

		const { commandName } = interaction;
		const command = commands[commandName];

		if (!command) return;
		try {
			await command.execute(interaction);
		}
		catch (error) {
			log.error(error);
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	});

	// Autocomplete interactions
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isAutocomplete()) return;

		const { commandName } = interaction;
		const command = commands[commandName];
		if (!command || !command.autocomplete) return;
		try {
			await command.autocomplete(interaction);
		}
		catch (error) {
			log.error(error);
		}
	});

	// Button interactions
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isButton()) return;

		if (interaction.customId.startsWith('departures-')) {
			const stopId = interaction.customId.split('-')[1];
			const response = await getArrivals(stopId);
			return interaction.reply({
				components: [
					new TextDisplayBuilder().setContent('Partidas'),
					new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
					new TextDisplayBuilder().setContent(response),
				],
				flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
			});
		}
	});

	const rest = new REST().setToken(token);

	// and deploy your commands!
	(async () => {
		try {
			// The put method is used to fully refresh all commands in the guild with the current set
			const data = await rest.put(
				Routes.applicationCommands(clientId), {
					body: updateCommands,
				},
			);
			if (data instanceof Array)
				log.success(`Successfully reloaded ${data.length} (/) commands.`);
			else
				log.error('Failed to reload commands, received:', data);
		}
		catch (error) {
		// And of course, make sure you catch and log any errors!
			log.error(error);
		}
	})();
}
