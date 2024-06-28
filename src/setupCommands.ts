import { AutocompleteInteraction, type CacheType, ChatInputCommandInteraction, type Client, Events, REST, Routes, SlashCommandBuilder, type SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

import favorite from './commands/favorite';
import { makeHelpCommand } from './commands/help';
import selectChannel from './commands/selectChannel';
import { clientId, token } from './env';
import log from './utils/logging';

const rawCommands: {
	autocomplete?: (interaction: AutocompleteInteraction<CacheType>) => Promise<unknown>
	data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder
	execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>
}[] = [
	selectChannel,
	favorite,
];
rawCommands.push(makeHelpCommand(rawCommands.map(command => [command.data.name, command.data.description])));

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
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
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
