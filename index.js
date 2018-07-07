const SlackBot = require('slackbots');
const axios = require('axios');

const bot = new SlackBot({
	token: 'xoxb-299068034276-394502308610-JdAWPgDv548gGU5ZsPAsnWzM',
	name: 'Code Noobs Bot'
});

// Start Handler
bot.on('start', () => {
	const params = {
	icon_emoji: ':smiley:'
	};

	bot.postMessageToChannel('bot-testing', "Don't panic", params);
});

// Error Handler
bot.on('error', err => console.log(err));
