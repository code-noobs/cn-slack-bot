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
    if(message.includes('dns')) {
        // Take the data I want and re-organize for the API to use
        // This removes the user ID text <@XXXXXXXXX>
        var buf1 = Buffer.allocUnsafe(26);
        buf1 = message;
        buf2 = buf1.slice(13, buf1.length);
        message = buf2.toString('ascii', 0, buf2.length);

        /* There may be a better way with the Slack API, but this will work
        returns URL as a string without extra formatting. Pre-formatted text appears like:
        <http://webbhost.net|webbhost.net> */
        var n = message.indexOf('|');
        var o = message.indexOf('>');
        console.log(n);
        console.log(o);
        console.log(o-1);
        var n = n+1;
        var o = o-2;
        var s1 = message.substr(n, o);
        console.log(s1+"s1");
        var p = s1.indexOf('>');
        var s2 = s1.substr(0, p);
        console.log(s2+"s2");
        message = s2;
        dnsLookup(message);
        
	} else if(message.includes(' whois')) {
        // Take the data I want and re-organize for the API to use
        // This should probably be it's own function
        var buf1 = Buffer.allocUnsafe(26);
        buf1 = message;
        buf2 = buf1.slice(13, buf1.length);
        message = buf2.toString('ascii', 0, buf2.length);
        console.log(message); // first message

        // Select part of message to remove
        // returns null
        //returns input.. and stuff posted here: https://webbhost.slack.com/archives/CBLERPJCA/p1531193642000053
        

        /* Let's try not using regex shall we? */
        var n = message.indexOf('|');
        var o = message.indexOf('>');
        console.log(n);
        console.log(o);
        console.log(o-1);
        var n = n+1;
        var o = o-2;
        var s1 = message.substr(n, o);
        console.log(s1+"s1");
        var p = s1.indexOf('>');
        var s2 = s1.substr(0, p);
        console.log(s2+"s2");
        message = s2;
		whoisLookup(message);
	}
}



// Pull dns-api.org information
function dnsLookup(message) {
    axios.get(dnsApi + '\/NS' + '\/'+ message).then(res => {
    
        const dns = res.data;
    
        console.log(dns); 
    
        const params = {
          icon_emoji: ''
        };
    
        bot.postMessageToChannel('bot-testing', dns, params);
      });
    axios.get(dnsApi + '\/A' + '\/'+ message).then(res => {
    
	const dns = res.data;

	console.log(dns); 

    const params = {
      icon_emoji: ''
    };
    axios.get(dnsApi + '\/CNAME' + '\/'+ message).then(res => {
    
        const dns = res.data;
    
        console.log(dns); 
    
        const params = {
          icon_emoji: ''
        };
    
        bot.postMessageToChannel('bot-testing', dns, params);
      });

    bot.postMessageToChannel('bot-testing', dns, params);
  });
  axios.get(dnsApi + '\/MX' + '\/'+ message).then(res => {
    
	const dns = res.data;

	console.log(dns); 

    const params = {
      icon_emoji: ''
    };

    bot.postMessageToChannel('bot-testing', dns, params);
  });
  axios.get(dnsApi + '\/TXT' + '\/'+ message).then(res => {
    
	const dns = res.data;

	console.log(dns); 

    const params = {
      icon_emoji: ''
    };

    bot.postMessageToChannel('bot-testing', dns, params);
  });

}

// integrate whois API
function whoisLookup(message){
var url = "https://www.whoisxmlapi.com/"
    +"whoisserver/WhoisService?";
var parameters = {
		domainName: message,
		apiKey: process.env.WHOIS_API_KEY,
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
                bot.postMessageToChannel('bot-testing','Created date: '+ parsedData.WhoisRecord.createdDate);
                bot.postMessageToChannel('bot-testing','Updated date: '+ parsedData.WhoisRecord.updatedDate);
                bot.postMessageToChannel('bot-testing','Expired date: '+ parsedData.WhoisRecord.expiresDate);
                bot.postMessageToChannel('bot-testing', parsedData.WhoisRecord.registrant.rawText);
                bot.postMessageToChannel('bot-testing', parsedData.WhoisRecord.administrativeContact.rawText);
                
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