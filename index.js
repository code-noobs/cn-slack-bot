const SlackBot = require('slackbots');
const axios = require('axios');
const https = require('https');
const querystring = require('querystring');
const env = require('dotenv');
env.config({path:
        '.env'});

const bot = new SlackBot({
	token: process.env.SLACK_API_TOKEN,
	name: 'Code Noobs Bot'
});

const dnsApi = 'https://dns-api.org';
const CHANNEL = 'bot-testing';

// Expected shape: "<@USERID> dns <domain>" / "<@USERID> whois <domain>"
const COMMAND_PATTERN = /^<@[A-Z0-9]+>\s+(dns|whois)\s+(.+?)\s*$/i;

// Slack auto-wraps links as <http://example.com|example.com> or <http://example.com>
const SLACK_LINK_PATTERN = /^<[a-z][a-z0-9+.-]*:\/\/([^|>]+)(?:\|[^>]+)?>$/i;

// Conservative hostname validation (labels of letters/digits/hyphens, dot separated)
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

// Crude per-user throttle so a single chatty user can't burn through the
// (rate-limited, billed) WHOIS quota or hammer dns-api.org via the bot.
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

// Pull dns-api.org information
function dnsLookup(domain) {
	const recordTypes = ['NS', 'A', 'CNAME', 'MX', 'TXT'];
	const encodedDomain = encodeURIComponent(domain);
	const params = {
		icon_emoji: ''
	};

	recordTypes.forEach(type => {
		axios.get(`${dnsApi}/${type}/${encodedDomain}`)
			.then(res => {
				bot.postMessageToChannel(CHANNEL, sanitizeForSlack(JSON.stringify(res.data)), params);
			})
			.catch(err => console.log(`DNS ${type} lookup for ${domain} failed:`, err.message));
	});
}

// integrate whois API
function whoisLookup(domain) {
	const url = 'https://www.whoisxmlapi.com/whoisserver/WhoisService?' + querystring.stringify({
		domainName: domain,
		apiKey: process.env.WHOIS_API_KEY,
		outputFormat: 'json'
	});

	https.get(url, function (res) {
		const statusCode = res.statusCode;

		if (statusCode !== 200) {
			console.log('WHOIS request failed: ' + statusCode);
			res.resume();
			return;
		}

		var rawData = '';

		res.on('data', function (chunk) {
			rawData += chunk;
		});
		res.on('end', function () {
			try {
				var parsedData = JSON.parse(rawData);
				var record = parsedData.WhoisRecord;

				if (!record) {
					console.log('WHOIS lookup for ' + domain + ' returned no record');
					return;
				}

				var summary = [
					'Domain name: ' + record.domainName,
					'Contact email: ' + record.contactEmail,
					'Created date: ' + record.createdDate,
					'Updated date: ' + record.updatedDate,
					'Expired date: ' + record.expiresDate
				].join('\n');

				bot.postMessageToChannel(CHANNEL, sanitizeForSlack(summary));
			} catch (e) {
				console.log(e.message);
			}
		});
	}).on('error', function (e) {
		console.log('Error: ' + e.message);
	});
}
