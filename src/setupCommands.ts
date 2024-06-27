import { type Client, Events, REST, Routes } from 'discord.js';

import selectChannel from './commands/selectChannel';
import { clientId, token } from './env';

const rawCommands = [
	selectChannel,
];
const commands = Object.fromEntries(rawCommands.map(command => [command.data.name, command]));
const updateCommands = rawCommands.map(command => command.data.toJSON());

export default function setupCommands(client: Client) {
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isCommand()) return;

		const { commandName } = interaction;
		const command = commands[commandName];

		if (!command) return;

		try {
			await command.execute(interaction);
		}
		catch (error) {
			console.error(error);
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	});

	const rest = new REST().setToken(token);

	// and deploy your commands!
	(async () => {
		try {
			console.log(`Started refreshing ${commands.length} application (/) commands.`);

			// The put method is used to fully refresh all commands in the guild with the current set
			const data = await rest.put(
				Routes.applicationCommands(clientId), {
					body: updateCommands,
				},
			);
			if (data instanceof Array)
				console.log(`Successfully reloaded ${data.length} application (/) commands.`);
			else
				console.log('Failed to reload commands, received:', data);
		}
		catch (error) {
		// And of course, make sure you catch and log any errors!
			console.error(error);
		}
	})();
}
