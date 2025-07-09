import { AutocompleteInteraction, ButtonStyle, type CacheType, ChatInputCommandInteraction, ContainerBuilder, InteractionContextType, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, SlashCommandBuilder, TextDisplayBuilder } from 'discord.js';

import { lines } from '../utils/lines';
import { getVehicles } from '../utils/vehicles';

const data = new SlashCommandBuilder()
	.setName('linha')
	.setDescription('Permite-te ver os veículos numa linha!')
	.addStringOption(opt =>
		opt
			.setName('line')
			.setAutocomplete(true)
			.setDescription('ID ou nome da linha')
			.setRequired(true),
	)
	.setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel);

async function getHeadsign(pattern: string) {
	const pInfo = await fetch('https://api.cmet.pt/patterns/' + pattern).then(r => r.json());
	if (!pInfo || pInfo.length < 1 || !pInfo[0].headsign) return 'N/A';
	return pInfo[0].headsign;
}

const execute = async (interaction: ChatInputCommandInteraction) => {
	const line = interaction.options.getString('line');
	const vehicles = await getVehicles();
	const now = Date.now();
	const lineInfo = lines.find(a => a.id === line);
	if (!lineInfo) return interaction.reply({ content: ':x: Linha desconhecida.', flags: [MessageFlags.Ephemeral] });
	const vehiclesInfo = vehicles.filter(v => v.line_id === line && v.timestamp > (now / 1000 - 3600));
	const patterns = await Promise.all(
		lineInfo.pattern_ids.map(async pattern => ({ headsign: await getHeadsign(pattern), id: pattern })),
	);
	const departureSections: SectionBuilder[] = [];
	patterns.forEach((pattern) => {
		let vehiclesContent = '*Não há veículos a efetuar este serviço*';
		const vehiclesFiltered = vehiclesInfo.filter(vec => vec.pattern_id === pattern.id);
		if (vehiclesFiltered.length > 0) {
			vehiclesContent = vehiclesFiltered.map(vec => '`' + vec.id + '` | ' + vec.make + ' ' + vec.model).join('\n');
		}
		departureSections.push(
			new SectionBuilder()
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent('### ' + lineInfo.id + ' | ' + pattern.headsign + '\n' + vehiclesContent + '\n-# Pattern ID: `' + pattern.id + '`'),
				)
				.setButtonAccessory(
					button => button
						.setURL('https://carrismetropolitana.pt/lines/' + lineInfo.id + '?active_pattern_id=' + pattern.id)
						.setLabel('Ver na CMet')
						.setStyle(ButtonStyle.Link),
				),
		);
	});

	const container = new ContainerBuilder()
		.setAccentColor(0xffdd00)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent('### ' + lineInfo.id + ' ' + lineInfo.long_name),
		)
		.addSeparatorComponents(
			new SeparatorBuilder({ divider: true, spacing: SeparatorSpacingSize.Small }),
		);
	departureSections.forEach((sect) => {
		container.addSectionComponents(sect);
		container.addSeparatorComponents(new SeparatorBuilder({ divider: false, spacing: SeparatorSpacingSize.Small }));
	});

	interaction.reply({
		components: [
			container,
		],
		flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] });
};

const autocomplete = async (interaction: AutocompleteInteraction<CacheType>) => {
	const focusedValue = interaction.options.getFocused();
	const filtered = lines.filter(line => line.id.toLowerCase().startsWith(focusedValue.toLowerCase()) || line.long_name.toLowerCase().startsWith(focusedValue.toLowerCase()));
	await interaction.respond(filtered.slice(0, 25).map(v => ({ name: v.id + ' | ' + v.long_name, value: v.id })));
};

export default {
	autocomplete,
	data,
	execute,
};
