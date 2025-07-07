import { ActionRowBuilder, AttachmentBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, type CacheType, CommandInteraction, CommandInteractionOptionResolver, ContainerBuilder, InteractionContextType, MediaGalleryBuilder, MediaGalleryItemBuilder, type MessageActionRowComponentBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, SlashCommandBuilder, TextDisplayBuilder } from 'discord.js';

import { getArrivals } from '../utils/departures';
import render from '../utils/render';
import { stops } from '../utils/stops';

const data = new SlashCommandBuilder()
	.setName('paragem')
	.setDescription('Permite-te ver as informações de uma paragem!')
	.addStringOption(opt =>
		opt
			.setName('stop')
			.setAutocomplete(true)
			.setDescription('ID ou nome da paragem')
			.setRequired(true),
	)
	.setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel);

const execute = async (interaction: CommandInteraction<CacheType>) => {
	const stop = (interaction.options as CommandInteractionOptionResolver).getString('stop');
	const stopInfo = stops.find(s => s.id === stop);
	if (!stopInfo) return ({ content: ':x: Paragem desconhecida: `' + stop + '`.', flags: [MessageFlags.Ephemeral] });
	const image = await render.renderStopMap(stopInfo.lat, stopInfo.lon);
	interaction.reply({
		components: [
			new ContainerBuilder()
				.setAccentColor(0xffdd00)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent('### ' + stopInfo.long_name),
				)
				.addSeparatorComponents(
					new SeparatorBuilder({ divider: true, spacing: SeparatorSpacingSize.Small }),
				)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent('#️⃣ **ID:** `#' + stopInfo.id + '`'),
					new TextDisplayBuilder().setContent('🚌 **Linhas:** \n' + stopInfo.line_ids.join(', ')),
					new TextDisplayBuilder().setContent('🗺️ **Localização:** \n' + stopInfo.lat + ' ' + stopInfo.lon),
				)
				.addMediaGalleryComponents(
					new MediaGalleryBuilder()
						.addItems(
							new MediaGalleryItemBuilder()
								.setURL('attachment://map.png'),
						),
				)
				.addActionRowComponents(
					new ActionRowBuilder<MessageActionRowComponentBuilder>()
						.addComponents(
							new ButtonBuilder()
								.setStyle(ButtonStyle.Link)
								.setLabel('Ver na CMet')
								.setURL('https://cmet.pt/stops/' + stopInfo.id),
							new ButtonBuilder()
								.setStyle(ButtonStyle.Primary)
								.setLabel('Ver partidas')
								.setCustomId('paragem:' + stopInfo.id),
						),
				),
		],
		files: [new AttachmentBuilder(image, { name: 'map.png' })],
		flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] });
};

const autocomplete = async (interaction: AutocompleteInteraction<CacheType>) => {
	const focusedValue = interaction.options.getFocused();
	const filtered = stops.filter(stop => stop.id.toLowerCase().startsWith(focusedValue.toLowerCase()));
	const filteredStart = stops.filter(stop => stop.long_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().startsWith(focusedValue.toLowerCase().replace(/[^a-z0-9]/g, '')));
	const filteredContains = stops.filter(stop => stop.long_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(focusedValue.toLowerCase().replace(/[^a-z0-9]/g, '')) && !stop.long_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().startsWith(focusedValue.toLowerCase().replace(/[^a-z0-9]/g, '')));

	const filteredFull = filtered.concat(filteredStart).concat(filteredContains);

	await interaction.respond(filteredFull.slice(0, 25).map(a => ({
		name: a.long_name + ' (#' + a.id + ')',
		value: a.id,
	}),
	));
};

const button = async (interaction: ButtonInteraction<CacheType>) => {
	const stopId = interaction.customId.split(':')[1];
	const response = await getArrivals(stopId);
	return interaction.reply({
		components: [
			new TextDisplayBuilder().setContent('Partidas'),
			new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
			new TextDisplayBuilder().setContent(response),
		],
		flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
	});
};

export default {
	autocomplete,
	button,
	data,
	execute,
};
