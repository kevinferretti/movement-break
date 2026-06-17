# Movement Break

A small PWA for movement breaks. It stores completion stats and personal preferences locally in the browser.

## Stack

- Vite, React, TypeScript
- Express production server
- Service worker and web app manifest
- Browser `localStorage` for signed-out stats
- Server-side OAuth sessions and persisted stats
- Docker Compose production deployment

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

- Pushups, pullups, and deadlifts
- Fixed random rep options: pullups `3-8`, pushups `15-30`, deadlifts `3-10`
- Random rep roll
- Configurable direct rep preset, default `20`
- Configurable enabled exercises for random rolls
- Completion logging
- Today and seven-day stats
- Google and GitHub login
- One-time local stat import per account

## Deployment Notes

The frontend needs HTTPS for mobile installation outside local development. Production serves the Vite build through the Express server on OVH. The public reverse proxy is managed by a shared `edge-proxy` Docker stack so the same box can host multiple unrelated apps.

The deployed app runs as a Docker Compose stack named `movement-break`, listens on container port `8787`, and joins the external Docker network `edge-proxy` with the `movement-break` alias. Merge `deploy/ovh/host-caddy.example` into the shared edge-proxy Caddyfile to route `movement.kevinferretti.com` to this app.

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
OVH_SSH_PRIVATE_KEY   # private deploy key for codex@movement.kevinferretti.com
OVH_SSH_KNOWN_HOSTS   # Tailscale SSH host key for 100.78.38.82
TS_OAUTH_CLIENT_ID    # Tailscale federated identity client id
TS_AUDIENCE           # Tailscale federated identity audience
OAUTH_GITHUB_CLIENT_ID
OAUTH_GITHUB_CLIENT_SECRET
OAUTH_GOOGLE_CLIENT_ID
OAUTH_GOOGLE_CLIENT_SECRET
```

The deploy job joins the tailnet as `tag:github-actions` and deploys to the VM
over its Tailscale IP. The tailnet policy must allow that tag to reach
`100.78.38.82:22`.

The deployed stack builds from `/opt/movement-break/current` and is managed by Docker Compose as project `movement-break`. Persistent app data is stored in `/opt/movement-break/shared/data.json`, mounted into the app container from `/opt/movement-break/shared`.
