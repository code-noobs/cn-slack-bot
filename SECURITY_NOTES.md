# Security review — fixes applied & open items

Tracking what changed in `index.js` / `package.json` for the security pass, and
what's deliberately left for a follow-up so nothing gets lost.

## Round 2 — backed off third-party API reliance entirely

Per follow-up direction to reduce reliance on external APIs (smaller surface,
fewer secrets, fewer trust dependencies), both lookups now run locally instead
of calling third-party HTTP services:

- **DNS**: replaced `axios.get(dns-api.org/...)` with Node's built-in
  `dns.promises.resolve{Ns,4,Cname,Mx,Txt}`. No outbound HTTP, no third party
  in the loop, structured results instead of text-scraping. `axios` is now an
  unused dependency and has been removed entirely (`package.json` +
  regenerated lockfile) — that also drops the last advisories that weren't
  already covered by the `slackbots`/`request` chain noted below.
- **WHOIS**: replaced the `whoisxmlapi.com` HTTP+API-key integration with a
  ~70-line raw WHOIS protocol client (`queryWhoisServer`/`lookupWhois` in
  `index.js`) built on the built-in `net` module — RFC 3912 is just
  "open a TCP socket to port 43, send `<query>\r\n`, read until close".
  This removes the `WHOIS_API_KEY` secret from the picture entirely (one less
  credential to provision, store, leak, or rotate) along with `https` and
  `querystring`.
  - **Referral handling / SSRF note**: WHOIS lookups work by asking
    `whois.iana.org` which registry is authoritative for a TLD, then querying
    that registry directly — the registry hostname comes from a `refer:` line
    in IANA's response. To make sure a compromised/spoofed referral can't be
    used to redirect our outbound TCP connection to an arbitrary internal
    host, `extractReferral()` validates the referral against the same
    `DOMAIN_PATTERN` used for user input before connecting to it — this
    rejects IP literals (the pattern requires an alphabetic TLD) and anything
    with whitespace/control characters. The port is hardcoded to 43.
  - Response size is capped (`WHOIS_MAX_BYTES`, 100 KB) and the Slack reply is
    truncated (`WHOIS_REPLY_LIMIT`, 3000 chars) so a verbose/malicious WHOIS
    server can't be used to flood the channel or exhaust memory.
  - **Operational note**: this needs outbound TCP connectivity on port 43 from
    wherever the bot runs (raw sockets, not HTTP — different egress rules than
    the old HTTPS-only setup). Confirm the deploy host allows it; this sandbox
    didn't, so the client couldn't be live-tested end-to-end here, only
    code-reviewed and unit-checked against the protocol spec. The `dns`-based
    lookup *was* exercised live and returned real records.
- README updated with a short pointer to this doc so the "Stack"/"What it did"
  sections (which now describe the original 2018 implementation, not the
  current one) aren't read as current.

## Fixed in round 1

- **Rewrote message parsing** (`index.js`): replaced the manual
  `Buffer.allocUnsafe` + `slice`/`indexOf`/`substr` chain (which threw on any
  message that didn't match the exact expected shape — the documented crash
  loop pm2 was band-aiding) with a single regex (`COMMAND_PATTERN`) that
  validates the `<@USERID> dns|whois <domain>` shape up front, plus a
  `DOMAIN_PATTERN` check on the extracted value before it's ever used.
- **Stopped building lookups from raw, unvalidated message text.** The
  extracted value is validated against a hostname pattern (`DOMAIN_PATTERN`)
  before it's used anywhere — originally this guarded URL construction; after
  round 2 (below) it also doubles as the guard against WHOIS protocol
  injection and SSRF-via-referral, and against `dns.resolve*` being called
  with garbage.
- **Added a per-user rate limit** (`isRateLimited`, 5 lookups/minute/user) so
  a single chatty (or malicious) user can't flood the channel or hammer
  upstream DNS/WHOIS infrastructure through the bot. (Originally written to
  guard a billed third-party API quota; still useful as a general flood guard
  now that lookups run locally.)
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

- **WHOIS output is now raw-text-relayed (truncated + escaped), not
  field-summarized — re-evaluate the PII tradeoff.** Round 1 deliberately
  dropped `registrant`/`administrativeContact` free-text fields from the old
  JSON API to avoid relaying PII and attacker-influenceable content. Round 2's
  swap to direct WHOIS-protocol queries returns *only* raw registry text (no
  structured JSON to summarize from), so the bot now posts a sanitized,
  size-capped excerpt of whatever the registry returns — which inherently
  includes registrant contact info for registries that don't redact it
  (many gTLD registries do redact for privacy; ccTLD registries vary widely).
  `sanitizeForSlack` neutralizes Slack-injection risk, and the byte/char caps
  bound flooding, but **PII exposure in the relayed text is back on the table**
  and depends entirely on what the authoritative registry chooses to publish.
  Worth a follow-up decision: is a raw (capped) excerpt acceptable, or should
  the bot regex-strip common PII-bearing lines (address/phone/email) before
  posting, at the cost of being less complete and more registry-format-fragile?
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
