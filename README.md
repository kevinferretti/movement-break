# Movement Break

A small PWA for pushup breaks. It stores completion stats and personal preferences locally in the browser.

## Stack

- Vite, React, TypeScript
- Express production server
- Service worker and web app manifest
- Browser `localStorage` for signed-out stats
- Server-side OAuth sessions and persisted leaderboard stats

## Local Setup

Install dependencies:

```sh
npm install
```

Create a local environment file:

```sh
Copy-Item .env.example .env
```

Google and GitHub login buttons only appear when the matching OAuth client id and secret are set in `.env`.

Run the app:

```sh
npm run dev
```

The app runs at `http://localhost:5175`. The API runs at `http://localhost:8787` and Vite proxies `/api` to it.

## Scripts

```sh
npm run dev          # frontend + local server
npm run build        # typecheck + production frontend build
npm run preview      # build, then serve the built app from Express
npm run test         # unit tests
npm run lint         # eslint
```

## Current MVP

- Pushups only
- Fixed rep options: `1-10` and `20`
- Random rep roll
- Configurable direct rep preset, default `20`
- Completion logging
- Today and seven-day stats
- Google and GitHub login
- One-time local stat import per account
- Persistent leaderboard totals

## Deployment Notes

The frontend needs HTTPS for mobile installation outside local development. Production serves the Vite build through the Express server behind Caddy on OVH.

Production OAuth callback URLs:

```text
https://movement.kevinferretti.com/api/auth/github/callback
https://movement.kevinferretti.com/api/auth/google/callback
```

Local OAuth callback URLs:

```text
http://localhost:5175/api/auth/github/callback
http://localhost:5175/api/auth/google/callback
```

## Continuous Deployment

Pushes to `main` deploy to `https://movement.kevinferretti.com` through `.github/workflows/deploy.yml`.

Required GitHub repository secrets:

```text
OVH_SSH_PRIVATE_KEY   # private deploy key for ubuntu@movement.kevinferretti.com
OVH_SSH_KNOWN_HOSTS   # output from: ssh-keyscan -t ed25519 movement.kevinferretti.com
OAUTH_GITHUB_CLIENT_ID
OAUTH_GITHUB_CLIENT_SECRET
OAUTH_GOOGLE_CLIENT_ID
OAUTH_GOOGLE_CLIENT_SECRET
```

The deployed service runs from `/opt/movement-break/current` and is managed by `systemd` as `movement-break`. Persistent app data is stored in `/opt/movement-break/shared/data.json`.
