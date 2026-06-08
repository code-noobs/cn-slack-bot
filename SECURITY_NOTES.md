# Security review — fixes applied & open items

Tracking what changed in `index.js` / `package.json` for the security pass, and
what's deliberately left for a follow-up so nothing gets lost.

## Fixed in this pass

- **Rewrote message parsing** (`index.js`): replaced the manual
  `Buffer.allocUnsafe` + `slice`/`indexOf`/`substr` chain (which threw on any
  message that didn't match the exact expected shape — the documented crash
  loop pm2 was band-aiding) with a single regex (`COMMAND_PATTERN`) that
  validates the `<@USERID> dns|whois <domain>` shape up front, plus a
  `DOMAIN_PATTERN` check on the extracted value before it's ever used.
- **Stopped building API URLs from raw, unvalidated message text.** The
  extracted value is now validated against a hostname pattern and
  `encodeURIComponent`-ed before being concatenated into the dns-api.org URL.
- **Added a per-user rate limit** (`isRateLimited`, 5 lookups/minute/user) so
  a single chatty (or malicious) user can't burn through the billed WHOIS API
  quota or hammer dns-api.org through the bot.
- **Sanitize everything relayed back into Slack** (`sanitizeForSlack`):
  escapes `&`/`<`/`>` and breaks up `@channel`/`@here`/`@everyone` tokens with
  a zero-width space, so attacker-influenceable third-party data (WHOIS
  registrant fields, DNS responses for domains the requester controls) can't
  be used to ping the channel or inject Slack link/format syntax through the
  bot's trusted identity.
- **Dropped `console.log(data)` of full Slack event payloads** — was logging
  user IDs and full message text to disk on every message.
- **Removed unused dependencies** (`express`, `body-parser`,
  `slack-events-listener` — none were referenced anywhere in the source) and
  bumped `axios` from `^0.18.0` to `^1.7.0`, clearing the SSRF / credential-leak
  / ReDoS / CSRF advisories that were open against the old major version.
  Lockfile regenerated.

## Deliberately scoped out — capture for follow-up

- **Dropped `registrant.rawText` / `administrativeContact.rawText` from the
  WHOIS reply.** These are large free-text blobs containing registrants' PII
  (names, addresses, phone numbers) and are the parts of a WHOIS record an
  attacker has the most control over (anyone can register a domain with
  arbitrary text in those fields, then ask the bot to look it up). Posting a
  structured summary instead removes both the PII-exposure and
  trusted-relay-injection angles. If the raw text is actually wanted back,
  it needs much stronger sanitization/truncation than a one-line escape.
- **`slackbots` itself is the remaining dependency risk.** It's unmaintained
  and pulls in the deprecated `request` → `form-data`/`tough-cookie`/`uuid`/`qs`
  chain, which has open advisories with **no fix available** (`npm audit`
  still reports 2 critical / 4 moderate after this pass, all transitive
  through `slackbots`). The only real fix is migrating off `slackbots` to a
  maintained Slack SDK (`@slack/bolt` or `@slack/web-api` + `@slack/rtm-api`)
  — that's a rewrite of the bot's transport layer, not a patch, so it's
  flagged here rather than attempted inline.
- **No channel/origin restriction on commands.** The bot still reacts to a
  matching mention from *any* channel or DM it can see (and always replies in
  `#bot-testing` regardless of where the command came from). Restricting
  triggers to a specific channel ID would need an async lookup of that
  channel's ID at startup — straightforward, but a behavior change worth
  confirming with whoever owns the bot before locking it down.
- **Credential rotation / history scrub** — out of scope for this code change
  (requires Slack app + WhoisXMLAPI account access, and a force-push history
  rewrite). Per the user, the previously-flagged `xoxb-...` token and
  WhoisXMLAPI key are already expired/non-issues for this private org repo,
  so no action taken here.
