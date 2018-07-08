const SlackBot = require('slackbots');
const axios = require('axios');

const bot = new SlackBot({
	token: 'xoxb-299068034276-394502308610-JdAWPgDv548gGU5ZsPAsnWzM',
	name: 'Code Noobs Bot'
});

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
	if(message.includes(' lastfm')) {	
	lastfmArtist();
	}
}

// Pull Last.FM artist information
function lastfmArtist() {
  axios.get('http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=prince&api_key=3cd4582d91ac24b7a041e998287b26d8&format=json').then(res => {
    console.log(res.data.artist['name']);    
    const artist = res.data.artist.name;
    const params = {
      icon_emoji: ':musical_score:'
    };

    bot.postMessageToChannel('bot-testing', artist, params);
  });
}
