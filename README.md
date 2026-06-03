# cn-slack-bot

> A Slack bot for DNS and WHOIS lookups. First org project. It worked — mostly.

Inspired by [Brad Traversy's slack_jokebot tutorial](https://github.com/bradtraversy/slack_jokebot/). Built over a month in summer 2018 as a first foray into bots and external APIs.

---

## What it did

Listened for commands in `#bot-testing` and hit external APIs:

| Command | Output |
|---|---|
| `dns [domain]` | A, NS, MX, TXT, CNAME records via [dns-api.org](https://dns-api.org) |
| `whois [domain]` | Registrant, contact email, created/updated/expired dates via [whoisxmlapi.com](https://whoisxmlapi.com) |

Responded with raw JSON dumps. Not pretty, but functional.

---

## Stack

- Node.js + `slackbots` + `axios`
- `.env` for credentials (`SLACK_API_TOKEN`, `WHOIS_API_KEY`)
- Deployed with **pm2** to keep it alive — the bot would crash on malformed Slack message events and pm2 was the band-aid

---

## Version arc

| Version | Date | What happened |
|---|---|---|
| v0.1 | 2018-07-07 | First working Slack connection. Posted "Don't panic" on start. Initial commits from a Debian server as `root`. |
| v0.2 | 2018-07-08 | Added Last.FM API (URL-only, never fully worked), swapped in DNS API, added WHOIS via `whoisxmlapi.com`. |
| v0.3 | 2018-07-11 | Things were broken. Switched back to master to stabilize. Partial fixes in place but not clean. |
| v1.0 | 2018-08-10 | URL parsing finally correct — Slack wraps links as `<http://url|url>` and the parser had to manually slice it out. APIs returning real data end-to-end. Called it working. |
| v1.1 | 2018-08-12 | Post-release fixes. An `errors-on-master` branch appeared the same night with a `.env` tweak (`hopefully fixing v2`) — last recorded activity. |

---

## Post-mortem

**What worked:** DNS and WHOIS lookups via command strings in Slack. The URL-parsing problem (Slack's `<http://url|url>` formatting) took the most time to solve and was the real core of the work.

**What was rough:**
- The bot crashed on any non-`message` event type it didn't expect. The `data.type !== 'message'` guard helped but wasn't airtight.
- `pm2` was doing the real reliability work — restart-on-crash rather than fixing the crash.
- URL parsing logic was duplicated verbatim between the `dns` and `whois` handlers. Should have been a shared function.
- `node_modules/` and `npm-debug.log` got committed. `.env` with live keys got committed. No `.gitignore` existed.
- `staging` was created as an orphan branch to scrub credential history, then abandoned after one more commit. The credentials stayed on `master` anyway.
- Results posted as raw JSON arrays directly to Slack — readable but not formatted.
- Last.FM integration was started and dropped.

**What this was for:** Learning — Slack API event model, external REST APIs, async Node patterns, running a persistent process on a server. All of that landed.
