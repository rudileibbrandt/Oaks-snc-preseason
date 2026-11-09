# SportsEngine API — roster sync notes

Checked 8 Nov 2026. Status: **blocked on API keys.**

## Why

The app's team list (`services/rosterData.ts`) gets each player's squad (Varsity/JV) from SportsEngine. Today we sync by reading the roster pages in Chrome during a Claude Code session. The official API would let a script list roster changes instead.

## What the API offers

- GraphQL: `POST https://api.sportsengine.com/graphql`, header `Authorization: Bearer <token>`.
- Schema explorer: https://dev.sportsengine.com/explorer (introspection works without logging in).
- Oaks club (organization) id: **6675**. Varsity and JV are separate teams under it.
- `teams(organizationId: 6675)` lists the teams; `team(id) { players { ... } }` gives the roster.
- `Player` fields: `firstName`, `lastName`, `jerseyNumber`, `rosterStatus`, `profileId`, `photoUrl`, `title`, `created`, `updated`.
- **No position field.** The roster page's Position column is blank for players too. Positions stay in the app.
- Webhooks exist (a team "update" covers any roster change), but they need a server. We decided against a server: sync stays in Claude Code.

## The blocker

- Keys (Client ID + Client Secret) come from **"API Settings"** in a SportsEngine account.
- Rudi's HQ login shows only Competition and Website. The club Settings page (`org.sportngin.com/org/6675/settings`) says "Access Denied. Contact your webmaster."
- The developer forum (community.sportsengine.com) is offline.

**Next step:** ask whoever runs the Oaks club in SportsEngine to either give Rudi Full Access, or request API keys for the club. Failing that, ask SportsEngine support. Keep the secret out of chat and out of the repo.

## Plan once keys exist

1. A local script uses the User Authentication flow:
   - `GET https://user.sportsengine.com/oauth/authorize?client_id=…&redirect_uri=http://localhost:<port>/callback&response_type=code`
   - Rudi logs in once.
   - The script swaps the code (valid 30 seconds) at `POST https://user.sportsengine.com/oauth/token`.
   - The access token lasts about 30 minutes. The refresh token is stored on Rudi's Mac, e.g. `~/.config/oaks/`, never in the repo.
   - The localhost redirect URI must be registered in API Settings.
2. Read-only: pull both teams' players and print new, gone and changed-squad players against `services/rosterData.ts`.
3. Claude updates `rosterData.ts` from that list; Rudi deploys.
4. Name traps still apply: "Demetrius Ball" = Asher Ball, "ANIRUDH DUGGINENI" = Rudy Duggineni, and Robert Duncan Anderson is both a coach (the dad) and a player (the son). Never guess a match.

## Don't

- Don't build on the internal endpoint the roster page uses (`api.sportngin.com/v3/roster_personas`). It is tied to the browser login and can change without notice.

## Sources

- https://www.sportsengine.com/integrations-api
- https://help.sportsengine.com/en/articles/8891727-authenticating-with-sportsengine
- https://help.sportsengine.com/en/articles/8336934-navigating-teams-and-rosters
- https://help.sportsengine.com/en/articles/8346198-leveraging-webhooks-for-data-changes
- https://help.sportsengine.com/en/articles/8677002-frequently-asked-questions-for-api
