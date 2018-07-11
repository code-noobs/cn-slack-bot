const SlackBot = require('slackbots');
const axios = require('axios');
const https = require('https');
const querystring = require('querystring');

const bot = new SlackBot({
	token: 'YOUR_SLACK_TOKEN',
	name: 'Code Noobs Bot'
});

const dnsApi = 'https://dns-api.org/';

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
    if(message.includes('\<\@')){
        // Take the data I want and re-organize for the API to use
        // This should probably be it's own function
        var buf1 = Buffer.allocUnsafe(26);
        buf1 = message;
        buf2 = buf1.slice(13, buf1.length);
        message = buf2.toString('ascii', 0, buf2.length);
        console.log(message);
        function dnsPath(message) {
            var data = message.toString();
            console.log(data);
        }       
        // Select part of message to remove
        // returns null
        //returns input.. and stuff posted here: https://webbhost.slack.com/archives/CBLERPJCA/p1531193642000053
        
        var regex = new RegExp(/^([<a-zA-Z:\/\/a-zA-Z\.a-zA-Z\|>])\w+/);
        var arrMatches = message.match(regex);
        console.log(arrMatches);
        message = arrMatches;
        return message;
        dnsLookup(message);
        
    } else if(message.includes(' dns')) {
        dnsLookup()
        
	} else if(message.includes(' whois')) {
		whoisLookup(message);
	}
}

// Pull dns-api.org information
function dnsLookup() {
    axios.get(dnsApi + '\/A' + '\/webbhost.net').then(res => {
    
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
		domainName: 'webbhost.net',
		apiKey: 'YOUR_WHOIS_API_KEY',
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