const SlackBot = require('slackbots');
const axios = require('axios');

const bot = new SlackBot({
	token: 'xoxb-299068034276-394502308610-JdAWPgDv548gGU5ZsPAsnWzM',
	name: 'Code Noobs Bot'
});

const dnsapi = 'https://dns-api.org/';

// Start Handler
bot.on('start', () => {
	const params = {
	icon_emoji: ':wave:'
	};

	bot.postMessageToChannel('bot-testing', "Don't panic", params);
});

// Error Handler
bot.on('error', err => console.log(err));

// Mesage Handler
bot.on('message', (data) => {
	if(data.type !== 'message'){
	return;
	}

	handleMessage(data.text);
});

// Respond to Data
function handleMessage(message) {
	if(message.includes(' dns')) {	
	dnsLookup();
	}
}

// Pull dns-api.org information
function dnsLookup() {
  axios.get('dnsapi').then(res => {
       
	const dns = res.data;
	console.log(dns); 

    const params = {
      icon_emoji: ''
    };

    bot.postMessageToChannel('bot-testing', dns, params);
  });
}
