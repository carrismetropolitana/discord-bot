/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from 'bun';
import colors from 'colors';
import { userMention } from 'discord.js';

import { client } from '..';

colors.enable();

function formattedDate() {
	const date = new Date();
	const day = date.getDate().toString().padStart(2, '0');
	const month = date.getMonth().toString().padStart(2, '0');
	const year = date.getFullYear();
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	const seconds = date.getSeconds().toString().padStart(2, '0');
	return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

async function log(str: string, mention = false) {
	const debug_id = env.DEBUG_CHANNEL_ID;
	if (debug_id) {
		const channel = client.channels.cache.get(debug_id);
		if (channel && channel.isTextBased()) {
			const msg = '```ansi\n' + str + '\n```';
			const owner_id = env.OWNER_ID;
			if (mention && owner_id) {
				channel.send(msg + userMention(owner_id));
			}
			else {
				channel.send(msg);
			}
		}
	}
	console.log(str);
}

export default {
	error: function error(...args: any[]) {
		const message = colors.red('[-] ' + formattedDate()) + ' ' + args.join(' ');
		log(message, true);
	},
	info: function info(...args: any[]) {
		const message = colors.blue('[+] ' + formattedDate()) + ' ' + args.join(' ');
		log(message);
	},
	success: function success(...args: any[]) {
		const message = colors.green('[+] ' + formattedDate()) + ' ' + args.join(' ');
		log(message);
	},
	warn: function warn(...args: any[]) {
		const message = colors.yellow('[!] ' + formattedDate()) + ' ' + args.join(' ');
		log(message, true);
	},
};
