# Battle for the Oceans — household deploy

LAN-only app on Spinney. Public `battlefortheoceans.com` is a Retired page on Vercel project `ocw` (not this repo).

## Runtime

| Item | Value |
|---|---|
| URL | `http://spinney.local:3002` |
| Process | LaunchAgent `com.household.battlefortheoceans` → `npx serve -s build -l 3002` |
| Install dir on Spinney | `~/BattleForTheOceans` |
| Logs | `~/Library/Logs/battlefortheoceans/stdout.log` and `stderr.log` |

## Feature switches (`.env`)

Compile-time (CRA). Owned by `src/constants/Features.js`. Unset = off.

```
REACT_APP_PURCHASE_ENABLED=false
REACT_APP_INVITE_ENABLED=false
```

With purchases off, every era is playable for guests and signed-in players (no Stripe/Brevo).

Also required in `.env` for build: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_KEY`, and guest credentials if used. Never commit `.env`.

Optional: `REACT_APP_GAME_CDN` — leave unset to serve assets from `public/`.

## Deploy from MacBook

1. Copy `deploy/household.env.example` → `deploy/household.env` (gitignored) and set `HOUSEHOLD_SSH` if needed.
2. From the app folder:

```bash
npm run deploy:household
```

This rsyncs to Spinney (excludes `build`, `node_modules`, `.git`, `.env`, …), syncs `.env`, runs `npm install` + `npm run build` on Spinney (arm64 MacBook → x86_64 Spinney), and restarts the LaunchAgent.

If LaunchAgent fails over SSH, on Spinney (GUI) double-click `Install Battle for the Oceans.command` or run `bash scripts/bootstrap-household-server.sh`.

## Local checks

```bash
npm run build
npx serve -s build -l 3002
# SPA fallback:
curl -s localhost:3002/reset-password | grep '<div id="root">'
```

## Hub menu

`spinney-hub` lists Battle for the Oceans on port `3002` → `http://spinney.local/`.
