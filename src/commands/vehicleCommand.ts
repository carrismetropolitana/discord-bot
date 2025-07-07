import { AttachmentBuilder, AutocompleteInteraction, type CacheType, CommandInteraction, CommandInteractionOptionResolver, ContainerBuilder, InteractionContextType, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, SlashCommandBuilder, TextDisplayBuilder } from 'discord.js';

import render from '../utils/render';
import { stops } from '../utils/stops';
import { getVehicles, type Vehicle } from '../utils/vehicles';

const data = new SlashCommandBuilder()
	.setName('veiculo')
	.setDescription('Permite-te ver as informações de um veiculo!')
	.addStringOption(opt =>
		opt
			.setName('carro')
			.setAutocomplete(true)
			.setDescription('ID ou matrícula do veículo')
			.setRequired(true),
	)
	.setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel);

async function getHeadsign(pattern: string) {
	const pInfo = await fetch('https://api.cmet.pt/patterns/' + pattern).then(r => r.json());
	if (!pInfo || pInfo.length < 1 || !pInfo[0].headsign) return 'N/A';
	return pInfo[0].headsign;
}

function getStop(id: string) {
	const stopInfo = stops.find(a => a.id === id);
	if (!stopInfo) return ':x:';
	return stopInfo.long_name + ' | `#' + id + '`';
}

const execute = async (interaction: CommandInteraction<CacheType>) => {
	const vehicle = (interaction.options as CommandInteractionOptionResolver).getString('carro');
	const vehicles = await getVehicles();
	const vehicleInfo = vehicles.find(v => v.id === vehicle);
	if (!vehicleInfo) return ({ content: ':x: Veículo desconhecido: `' + vehicle + '`.', flags: [MessageFlags.Ephemeral] });
	interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
	vehicleInfo.state = 'normal';
	const now = Date.now();
	if (now > (vehicleInfo.timestamp + 300) * 1000) vehicleInfo.state = 'delay';
	if (now > (vehicleInfo.timestamp + 3600) * 1000) vehicleInfo.state = 'error';
	const image = await render.renderVehicleMap(vehicleInfo.lat, vehicleInfo.lon, [vehicleInfo], 'VEHICLE');
	interaction.editReply({
		components: [
			new ContainerBuilder()
				.setAccentColor(0xffdd00)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent('### ' + vehicleInfo.id + (vehicleInfo.make ? (' - ' + vehicleInfo.make + ' ' + vehicleInfo.model) : '')),
				)
				.addSeparatorComponents(
					new SeparatorBuilder({ divider: true, spacing: SeparatorSpacingSize.Small }),
				)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent('📓 **Matrícula: **' + (vehicleInfo.license_plate || ':x:')),
					new TextDisplayBuilder().setContent('👤 **Motorista: **' + (vehicleInfo.shift_id || ':x:')),
					new TextDisplayBuilder().setContent('🏳️ **Serviço: **' + (vehicleInfo.line_id ? (vehicleInfo.line_id + ' | ' + await getHeadsign(vehicleInfo.pattern_id)) : ':x:')),
					new TextDisplayBuilder().setContent('🗺️ **Posição: **' + vehicleInfo.lat.toFixed(5) + ' ' + vehicleInfo.lon.toFixed(5)),
					new TextDisplayBuilder().setContent('👋 **Próxima Paragem: **' + getStop(vehicleInfo.stop_id)),
					...(vehicleInfo.capacity_seated ? [
						new TextDisplayBuilder().setContent('💺 **Capacidade: **' + (vehicleInfo.capacity_total + 'px (' + vehicleInfo.capacity_seated + ' sentados + ' + vehicleInfo.capacity_standing + ' de pé)')),
					] : []),
					new TextDisplayBuilder().setContent('⏰ **Último update: **<t:' + (vehicleInfo.timestamp + ':R>')),
				)
				.addMediaGalleryComponents(
					new MediaGalleryBuilder()
						.addItems(
							new MediaGalleryItemBuilder()
								.setURL('attachment://map.png'),
						),
				),

		],
		files: [new AttachmentBuilder(image, { name: 'map.png' })],
		flags: [MessageFlags.IsComponentsV2] });
};

let vehicles: Vehicle[];

const autocomplete = async (interaction: AutocompleteInteraction<CacheType>) => {
	if (!vehicles) vehicles = await getVehicles();
	const focusedValue = interaction.options.getFocused();
	const filtered = vehicles.filter(v => v.id.split('|')[1].toLowerCase().startsWith(focusedValue.toLowerCase()) || v.license_plate?.toLowerCase().startsWith(focusedValue.toLowerCase()) || v.make?.toLowerCase().startsWith(focusedValue.toLowerCase()) || v.model?.toLowerCase().startsWith(focusedValue.toLowerCase()));
	await interaction.respond(filtered.slice(0, 25).map(v => ({ name: v.id + ' | ' + v.license_plate + (v.make ? (' - ' + v.make + ' ' + v.model) : ''), value: v.id })));
};

export default {
	autocomplete,
	data,
	execute,
};
