import { ActionRowBuilder, AttachmentBuilder, AutocompleteInteraction, ButtonBuilder, ButtonStyle, type CacheType, CommandInteraction, CommandInteractionOptionResolver, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, type MessageActionRowComponentBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, SlashCommandBuilder, TextDisplayBuilder } from 'discord.js';

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
	);

const execute = async (interaction: CommandInteraction<CacheType>) => {
	const stop = (interaction.options as CommandInteractionOptionResolver).getString('stop');
	const stopInfo = stops.find(s => s.id === stop);
	if (!stopInfo) return interaction.reply(':x: Paragem desconhecida: `' + stop + '`');
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
								.setCustomId('departures-' + stopInfo.id),
						),
				),
		],
		files: [new AttachmentBuilder(image, { name: 'map.png' })],
		flags: [MessageFlags.IsComponentsV2] });
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

export default {
	autocomplete,
	data,
	execute,
};
