# DISC RIOT 2084 online relay

A tiny Cloudflare Worker that pairs two players by a 4-letter room code and forwards their messages.
The match runs on the phones (rollback netcode in `src/net/`); this only relays. Fits Cloudflare's free plan.

## Deploy (one time, about 5 minutes)
1. Make a free account at https://dash.cloudflare.com/sign-up
2. On the Mac:
   ```sh
   cd server
   npm install
   npx wrangler login      # opens the browser to approve
   npx wrangler deploy     # prints https://disc-riot-relay.<your-subdomain>.workers.dev
   ```
3. Point the game at it. In the repo root, create `.env.production`:
   ```
   VITE_NET_URL=wss://disc-riot-relay.<your-subdomain>.workers.dev
   ```
   Then `npm run build` (web) or `npm run app:sync` (iOS/Android). The URL isn't secret, so this file can be committed.

## Test locally
`cd server && npx wrangler dev` (relay on port 8787), then `npm run dev` in the root: dev builds use
`ws://<host>:8787` automatically. Shortcut: open `/?room=ABCD&p1=nova&arena=1` in one tab and
`/?room=ABCD&p1=zara` in another. `?net=wss://…` overrides the relay URL in any build.

## Free-plan budget
Each player sends 30 messages a second (two frames of input per message). Cloudflare bills incoming
WebSocket messages at 20 per request, so a 3-minute match is about 550 requests: roughly 180 matches a day on the
free plan's 100,000 daily requests. The $5/month Workers plan lifts that to millions.
