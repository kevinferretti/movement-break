# Movement Break

A small PWA for pushup breaks. It stores rep settings and completion stats locally in the browser.

## Stack

- Vite, React, TypeScript
- Express production server
- Service worker and web app manifest
- Browser `localStorage` for personal stats

## Local Setup

Install dependencies:

```sh
npm install
```

Create a local environment file:

```sh
Copy-Item .env.example .env
```

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
- Configurable rep range, default `1-20`
- Random rep roll
- Completion logging
- Today and seven-day stats

## Deployment Notes

The frontend needs HTTPS for mobile installation outside local development. Production serves the Vite build through the Express server behind Caddy on OVH.

## Continuous Deployment

Pushes to `main` deploy to `https://movement.kevinferretti.com` through `.github/workflows/deploy.yml`.

Required GitHub repository secrets:

```text
OVH_SSH_PRIVATE_KEY   # private deploy key for ubuntu@movement.kevinferretti.com
OVH_SSH_KNOWN_HOSTS   # output from: ssh-keyscan -t ed25519 movement.kevinferretti.com
```

The deployed service runs from `/opt/movement-break/current` and is managed by `systemd` as `movement-break`.
