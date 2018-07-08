const SlackBot = require('slackbots');
const axios = require('axios');
const https = require('https');
const querystring = require('querystring');

const bot = new SlackBot({
	token: 'xoxb-299068034276-394502308610-JdAWPgDv548gGU5ZsPAsnWzM',
	name: 'Code Noobs Bot'
});

const dnsApi = 'https://dns-api.org/a/webbhost.net';

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
	console.log(data);
	handleMessage(data.text);
});



// Respond to Data
function handleMessage(message) {
	if(message.includes(' dns')) {
		
		console.log(message);
		dnsLookup();
	} else if(message.includes(' whois')) {
		whoisLookup();
	}
}

// Pull dns-api.org information
function dnsLookup() {
  axios.get(dnsApi).then(res => {
       
	const dns = res.data;
	

	console.log(dns); 

    const params = {
      icon_emoji: ''
    };

    bot.postMessageToChannel('bot-testing', dns, params);
  });
}

// integrate whois API
function whoisLookup(){
var url = "https://www.whoisxmlapi.com/"
    +"whoisserver/WhoisService?";
var parameters = {
		domainName: 'google.com',
		apiKey: 'at_eFYe3jSZXRIcAVywg2QKj9sbQjqzh',
		outputFormat: 'json'
};
url = url + querystring.stringify(parameters);

https.get(url, function (res) {
    const statusCode = res.statusCode;

    if (statusCode !== 200) {
        console.log('Request failed: '
            + statusCode
        );
    }

    var rawData = '';

    res.on('data', function(chunk) {
        rawData += chunk;
    });
    res.on('end', function () {
        try {
            var parsedData = JSON.parse(rawData);
            if (parsedData.WhoisRecord) {
                bot.postMessageToChannel('bot-testing','Domain name: '+ parsedData.WhoisRecord.domainName);
				bot.postMessageToChannel('bot-testing','Contact email: '+ parsedData.WhoisRecord.contactEmail);
            } else {
                console.log(parsedData);
            }
        } catch (e) {
            console.log(e.message);
        }
    })
}).on('error', function(e) {
    console.log("Error: " + e.message);
});

}