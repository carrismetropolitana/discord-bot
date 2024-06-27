/* eslint-disable @typescript-eslint/no-explicit-any */
import colors from 'colors';

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

export default {
	error: function error(...args: any[]) {
		console.log(colors.red('[-] ' + formattedDate()), ...args);
	},
	info: function info(...args: any[]) {
		console.log(colors.blue('[+] ' + formattedDate()), ...args);
	},
	success: function success(...args: any[]) {
		console.log(colors.green('[+] ' + formattedDate()), ...args);
	},
	warn: function warn(...args: any[]) {
		console.log(colors.yellow('[!] ' + formattedDate()), ...args);
	},
};
