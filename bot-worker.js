"use strict";

const bot_username = 'BrowserMessageSenderBot';

// These variables are managed by Cloudflare Secrets
// const BOT_TOKEN = ''; 
// const TELEGRAM_WEBHOOK_SECRET_TOKEN = '';

// Cloudflare KV
// TELEGRAM_TOKEN_STORE

const helper_webpage_url = 'https://telegrammessagesenderbot-web.pages.dev/';
const github_repo = 'https://github.com/Hixon10/TelegramMessageSenderBot';

function getAboutBotInfo() {
	return '' +
		'1. Generate a token (/addtoken YOUR_TOKEN_ALIAS)\n' +
		'2. Delete a token (/deletetoken YOUR_TOKEN_ALIAS)\n' +
		'3. Get list of your tokens (/mytokens)\n' +
		'4. Get a Source Code (/about)\n' +
		'5. Web UI is available on ' + helper_webpage_url + '\n' +
		'6. Get user manual (/help)'
}

addEventListener('fetch', event => {
	event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
	if (request.method === 'POST') {
		const { pathname } = new URL(request.url);
		
		// handle user sendMessage request (user tries to send something to him/her bot)
		if (pathname == "/sendMessage") {
			try {
				return await handle_user_sendMessage(request)
			} catch (e) {
				console.log('[ERROR] Received error in handle_user_sendMessage', e.toString(), e.stack, e.name)
			}
			return new Response('Unhandled exception: ', {status: 500})
		}
		
		// handle telegram request
		const clientIP = request.headers.get('CF-Connecting-IP')
		if (!(inSubNet(clientIP, '149.154.160.0/20') ||
			inSubNet(clientIP, '91.108.4.0/22'))) {

			// https://core.telegram.org/bots/webhooks#an-open-port
			console.log("[ERROR] received request from non telegram IP: ", clientIP)
			return new Response('ok: ', {status: 200})
		}
		
		const request_tg_token = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
		if (request_tg_token !== TELEGRAM_WEBHOOK_SECRET_TOKEN) {
			console.log("[ERROR] received request with wrong telegram token: ", request_tg_token)
			return new Response('ok: ', {status: 200})
		}
		
		let data = await request.json()
		if (data.message !== undefined) {
			try {
				await handle_telegram_message(data.message)
			} catch (e) {
				console.log('[ERROR] Received error in handle_telegram_message', e.toString(), e.stack, e.name)
			}
		} else {
			console.log("[ERROR] received empty post request", data)
		}
	} else {
		console.log("[ERROR] received get request")
	}

	return new Response('ok: ', {status: 200})
}

async function handle_user_sendMessage(req) {
	const content_type = req.headers.get("Content-Type");
	if (!content_type.startsWith("multipart/form-data")) {
		return new Response('expected multipart/form-data, received: ' + content_type, {status: 400});
	}
	
	const formData = await req.formData();
	if (formData == null) {
		return new Response('formData is empty', {status: 400});
	}
	
	const token = formData.get("token");
	if (!token) {
		return new Response('token is empty. You need to generate a token in telegram bot.', {status: 400});
	}
	
	const user_chat_id = await TELEGRAM_TOKEN_STORE.get(token);
	if (!user_chat_id) {
		return new Response('unknown token. You need to generate a token in telegram bot.', {status: 400});
	}
	
	const userText = formData.get("text");
	if (userText) {
		try {
			await tg(BOT_TOKEN, 'sendmessage', {
				chat_id: user_chat_id,
				text: userText
			});
		} catch (e) {
			return new Response('got an error from telegram API, when sending text', {status: 500});
		}
		
		return new Response('text was sent', {status: 200});
	}
	
	const userImage = formData.get("image");
	if (userImage) {
		const tgFormData = new FormData();
		tgFormData.append('chat_id', user_chat_id);
		tgFormData.append('photo', userImage);
		
		try {
			await sendPhotoToTelegram(BOT_TOKEN, tgFormData);
		} catch (e) {
			return new Response('got an error from telegram API, when sending image', {status: 500});
		}
		
		return new Response('image was sent', {status: 200});
	}
	
	return new Response('we have not received eithet text, or image for sending', {status: 400});
}

async function handle_telegram_message(d) {
	let chat_id = d.chat.id
	let text = d.text || ''
	let otext = text.split(' ')
	if (text[0] === '/') {
		otext[0] = otext[0].replace('/', '').replace(bot_username, '')
		switch (otext[0]) {
			case 'start':
				await tg(BOT_TOKEN, 'sendmessage', {
					chat_id: chat_id,
					text: getAboutBotInfo()
				})
				break
			case 'addtoken':
				if (otext.length === 2 && otext[1] &&
					otext[1].length > 3 && otext[1].length < 65) {

					let tokenAliasWithPrefix = chat_id + "-p-" + otext[1]
					let tokenAlias = otext[1]

					const tokenAliasesListKey = chat_id + "-l"
					let existedTokenAliases = await getExistedTokenAliases(tokenAliasesListKey);
					
					if (existedTokenAliases.has(tokenAlias)) {
						await tg(BOT_TOKEN, 'sendmessage', {
							chat_id: chat_id,
							text: 'Token with given alias has already existed. alias=' + otext[1]
						})
						return;
					}
					
					existedTokenAliases.add(tokenAlias)
					await TELEGRAM_TOKEN_STORE.put(tokenAliasesListKey, JSON.stringify([...existedTokenAliases]))
					
					const generatedToken = generateToken();
					await TELEGRAM_TOKEN_STORE.put(tokenAliasWithPrefix, generatedToken);
					await TELEGRAM_TOKEN_STORE.put(generatedToken, chat_id);
					
					await tg(BOT_TOKEN, 'sendmessage', {
						chat_id: chat_id,
						text: 'Token saved: token=' + generatedToken
					})
				} else {
					await tg(BOT_TOKEN, 'sendmessage', {
						chat_id: chat_id,
						text: 'You need to send token alias. For example:\n' +
							'/addtoken your-token-alias'
					})
				}
				break
			case 'deletetoken':
				if (otext.length === 2 && otext[1] &&
					otext[1].length > 3 && otext[1].length < 65) {

					let tokenAliasWithPrefix = chat_id + "-p-" + otext[1]
					let tokenAlias = otext[1]

					const tokenAliasesListKey = chat_id + "-l"
					let existedTokenAliases = await getExistedTokenAliases(tokenAliasesListKey);
					
					if (!existedTokenAliases.has(tokenAlias)) {
						await tg(BOT_TOKEN, 'sendmessage', {
							chat_id: chat_id,
							text: 'Token with given alias is not found. alias=' + otext[1]
						})
						return;
					}
					
					const token = await TELEGRAM_TOKEN_STORE.get(tokenAliasWithPrefix);
					await TELEGRAM_TOKEN_STORE.delete(token);
					
					await TELEGRAM_TOKEN_STORE.delete(tokenAliasWithPrefix);
					
					existedTokenAliases.delete(tokenAlias)
					await TELEGRAM_TOKEN_STORE.put(tokenAliasesListKey, JSON.stringify([...existedTokenAliases]))
					
					await tg(BOT_TOKEN, 'sendmessage', {
						chat_id: chat_id,
						text: 'Token deleted: alias=' + tokenAlias
					})
				} else {
					await tg(BOT_TOKEN, 'sendmessage', {
						chat_id: chat_id,
						text: 'You need to send token alias. For example:\n' +
							'/deletetoken your-token-alias'
					})
				}
				break	
			case 'mytokens':
				const tokenAliasesListKey = chat_id + "-l"
				let mytokens_result = "You don't have saved tokens"
				let existedTokenAliases = await getExistedTokenAliases(tokenAliasesListKey);
				if (existedTokenAliases.size !== 0) {
					mytokens_result = 'Your saved tokens:\n' + Array.from(existedTokenAliases).join('\n')
				}
				await tg(BOT_TOKEN, 'sendmessage', {
					chat_id: chat_id,
					text: mytokens_result
				})
				break				
			case 'about':
				await tg(BOT_TOKEN, 'sendmessage', {
					chat_id: chat_id,
					text: github_repo
				})
				break				
			case 'help':
			default:
				await tg(BOT_TOKEN, 'sendmessage', {
					chat_id: chat_id,
					text: getAboutBotInfo()
				})
				break
		}
	} else {
		await tg(BOT_TOKEN, 'sendmessage', {
			chat_id: chat_id,
			text: getAboutBotInfo()
		})
	}
}

// https://stackoverflow.com/a/51540480/1756750
function generateToken() {
	 const wishlist = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	 return Array.from(crypto.getRandomValues(new Uint32Array(20)))
    .map((x) => wishlist[x % wishlist.length])
    .join('')
}

async function getExistedTokenAliases(tokenAliasesListKey) {
	const existedTokenAliasesArray = await TELEGRAM_TOKEN_STORE.get(tokenAliasesListKey, {type: 'json'}) || []
	let existedTokenAliases = new Set(existedTokenAliasesArray)
	if (!isEmpty(existedTokenAliasesArray)) {
		existedTokenAliases = new Set(existedTokenAliasesArray)
	}
	return existedTokenAliases;
}

async function sendPhotoToTelegram(token, data) {
	try {
		let t = await fetch('https://api.telegram.org/bot' + token + '/sendphoto', {
			method: 'POST',
			body: data
		})

		let d = await t.json()
		if (!d.ok) {
			throw d
		}
	} catch (e) {
		console.log('[ERROR] Received error in sendPhotoToTelegram catch', JSON.stringify(e), e.toString(), e.stack, e.name)
		throw e;
	}
}

async function tg(token, type, data, n = true) {
	try {
		let t = await fetch('https://api.telegram.org/bot' + token + '/' + type, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		})
		let d = await t.json()
		if (!d.ok && n)
			throw d
		else
			return d
	} catch (e) {
		console.log('[ERROR] Received error in tg catch', e.toString(), e.stack, e.name)
		throw e;
	}
}

function ip2long(ip) {
	var components = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

	if (components) {
		var iplong = 0;
		var power = 1;
		for (var i = 4; i >= 1; i -= 1) {
			iplong += power * parseInt(components[i]);
			power *= 256;
		}
		return iplong;
	}

	return -1;
}

// https://stackoverflow.com/a/679937/1756750
function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}

// https://stackoverflow.com/a/18001764/1756750
function inSubNet(ip, subnet) {
	var mask, base_ip, long_ip = ip2long(ip);
	if ((mask = subnet.match(/^(.*?)\/(\d{1,2})$/)) && ((base_ip = ip2long(mask[1])) >= 0)) {
		var freedom = Math.pow(2, 32 - parseInt(mask[2]));
		return (long_ip > base_ip || long_ip === base_ip) && ((long_ip < base_ip + freedom - 1) || (long_ip === base_ip + freedom - 1));
	}

	return false;
}
