# cn-slack-bot

Inspired by https://github.com/bradtraversy/slack_jokebot/ great tutorial!

End-goal is to have a Slackbot that can take domains and give who.is/DNS records, possibly github repos.

who.is API: https://whoisxmlapi.com DNS API: https://dns-api.org

Working commands:
dns + [google.com] returns A, NS, MX, TXT records for [domain]
whois + [domain] returns contact email, registrant, admin contact, as wella s created, updated, expired dates.