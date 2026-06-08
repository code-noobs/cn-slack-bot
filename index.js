const SlackBot = require('slackbots');
const dns = require('dns').promises;
const net = require('net');
const env = require('dotenv');
env.config({path:
        '.env'});

const bot = new SlackBot({
	token: process.env.SLACK_API_TOKEN,
	name: 'Code Noobs Bot'
});

const CHANNEL = 'bot-testing';

// Expected shape: "<@USERID> dns <domain>" / "<@USERID> whois <domain>"
const COMMAND_PATTERN = /^<@[A-Z0-9]+>\s+(dns|whois)\s+(.+?)\s*$/i;

// Slack auto-wraps links as <http://example.com|example.com> or <http://example.com>
const SLACK_LINK_PATTERN = /^<[a-z][a-z0-9+.-]*:\/\/([^|>]+)(?:\|[^>]+)?>$/i;

// Conservative hostname validation (labels of letters/digits/hyphens, dot
// separated, alphabetic TLD). Doubles as protection against CRLF/argument
// injection downstream — it can't match anything containing whitespace,
// control characters, or a leading '-' or numeric/IP-literal TLD.
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const lookupHistory = new Map(); // userId -> recent lookup timestamps

// Start Handler
bot.on('start', () => {
	const params = {
	icon_emoji: ':wave:'
	};

	bot.postMessageToChannel(CHANNEL, "Don't panic", params);
});

// Error Handler
bot.on('error', err => console.log(err));

// Mesage Handler
bot.on('message', (data) => {
	if (data.type !== 'message' || !data.text || !data.user) {
		return;
	}
	handleMessage(data.user, data.text);
});

// Pull the requested command + domain out of a mention, e.g.
// "<@U12345> dns <http://example.com|example.com>" -> { command: 'dns', domain: 'example.com' }
// Returns null if the message isn't a recognized command or the domain looks invalid.
function parseCommand(text) {
	const match = text.match(COMMAND_PATTERN);
	if (!match) {
		return null;
	}

	const command = match[1].toLowerCase();
	const rawArg = match[2].trim();
	const linkMatch = rawArg.match(SLACK_LINK_PATTERN);
	const candidate = (linkMatch ? linkMatch[1] : rawArg).toLowerCase();

	if (!DOMAIN_PATTERN.test(candidate)) {
		return null;
	}

	return { command, domain: candidate };
}

// Crude per-user throttle so a single chatty user can't flood DNS/WHOIS lookups.
function isRateLimited(userId) {
	const now = Date.now();
	const recent = (lookupHistory.get(userId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
	recent.push(now);
	lookupHistory.set(userId, recent);
	return recent.length > RATE_LIMIT_MAX;
}

// Escape Slack mrkdwn control characters and break up broadcast-mention tokens
// so that data we don't control (DNS/WHOIS responses) can't be used to ping
// @channel/@here/@everyone or smuggle link syntax when relayed into Slack.
function sanitizeForSlack(text) {
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/@(channel|here|everyone)/gi, '@​$1');
}

// Respond to Data
function handleMessage(userId, text) {
	const parsed = parseCommand(text);
	if (!parsed) {
		return;
	}

	if (isRateLimited(userId)) {
		return;
	}

	if (parsed.command === 'dns') {
		dnsLookup(parsed.domain);
	} else {
		whoisLookup(parsed.domain);
	}
}

// Resolve records locally via Node's built-in resolver — no third-party HTTP
// API, no API key, structured results straight from the OS/recursive resolver.
const RECORD_RESOLVERS = [
	['NS', dns.resolveNs],
	['A', dns.resolve4],
	['CNAME', dns.resolveCname],
	['MX', dns.resolveMx],
	['TXT', dns.resolveTxt]
];

function dnsLookup(domain) {
	RECORD_RESOLVERS.forEach(([type, resolve]) => {
		resolve(domain)
			.then(records => {
				bot.postMessageToChannel(CHANNEL, sanitizeForSlack(`*${type}* records for ${domain}:\n${JSON.stringify(records)}`));
			})
			.catch(err => {
				if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
					console.log(`${type} lookup for ${domain} failed:`, err.code || err.message);
				}
			});
	});
}

const WHOIS_PORT = 43;
const WHOIS_TIMEOUT_MS = 10000;
const WHOIS_MAX_BYTES = 100 * 1024;
const WHOIS_REPLY_LIMIT = 3000;
const IANA_WHOIS_HOST = 'whois.iana.org';

// Speak the WHOIS protocol directly (RFC 3912 — it's just plaintext over TCP):
// open a socket, send "<query>\r\n", collect everything until the server closes
// the connection. No third-party HTTP API or API key required.
function queryWhoisServer(host, query) {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ host, port: WHOIS_PORT });
		let data = '';
		let settled = false;

		const finish = (err, result) => {
			if (settled) {
				return;
			}
			settled = true;
			socket.destroy();
			err ? reject(err) : resolve(result);
		};

		socket.setTimeout(WHOIS_TIMEOUT_MS);
		socket.on('connect', () => socket.end(query + '\r\n'));
		socket.on('data', chunk => {
			data += chunk.toString('utf8');
			if (data.length > WHOIS_MAX_BYTES) {
				finish(new Error(`response from ${host} exceeded ${WHOIS_MAX_BYTES} byte limit`));
			}
		});
		socket.on('end', () => finish(null, data));
		socket.on('close', () => finish(null, data));
		socket.on('timeout', () => finish(new Error(`connection to ${host} timed out`)));
		socket.on('error', finish);
	});
}

// IANA's WHOIS server replies to a TLD query with "refer: whois.registry.tld" —
// the server actually authoritative for that TLD. Validate it against the same
// hostname pattern used for user input before connecting to it: this rejects
// IP literals (DOMAIN_PATTERN requires an alphabetic TLD) and anything with
// whitespace/control characters, so a compromised/spoofed referral can't be
// used to redirect our outbound connection to an arbitrary internal address.
function extractReferral(ianaResponse) {
	const match = ianaResponse.match(/^\s*refer:\s*(\S+)/im);
	const referral = match ? match[1].toLowerCase() : null;
	return referral && DOMAIN_PATTERN.test(referral) ? referral : null;
}

async function lookupWhois(domain) {
	const ianaResponse = await queryWhoisServer(IANA_WHOIS_HOST, domain);
	const referral = extractReferral(ianaResponse);

	if (!referral) {
		return ianaResponse;
	}

	try {
		return await queryWhoisServer(referral, domain);
	} catch (err) {
		console.log(`WHOIS referral query to ${referral} failed, falling back to IANA response:`, err.message);
		return ianaResponse;
	}
}

function whoisLookup(domain) {
	lookupWhois(domain)
		.then(rawText => {
			const trimmed = rawText.trim() || '(no WHOIS data returned)';
			const body = trimmed.length > WHOIS_REPLY_LIMIT
				? trimmed.slice(0, WHOIS_REPLY_LIMIT) + '\n… (truncated)'
				: trimmed;

			bot.postMessageToChannel(CHANNEL, sanitizeForSlack(`WHOIS for ${domain}:\n${body}`));
		})
		.catch(err => console.log(`WHOIS lookup for ${domain} failed:`, err.message));
}
