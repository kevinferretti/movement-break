# Movement Break

A small PWA for hourly pushup breaks. It stores rep settings and completion stats locally in the browser, and uses Web Push for real hourly reminders when a push server is configured.

## Stack

- Vite, React, TypeScript
- Express Web Push server
- Service worker and web app manifest
- Browser `localStorage` for personal stats
- JSON file persistence for push subscriptions

## Local Setup

Install dependencies:

```sh
npm install
```

Create a local environment file:

```sh
Copy-Item .env.example .env
npm run push:keys
```

Copy the generated `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` values into `.env`, then run:

```sh
npm run dev
```

The app runs at `http://localhost:5173`. The API runs at `http://localhost:8787` and Vite proxies `/api` to it.

If VAPID keys are missing, the UI shows notifications as unavailable instead of faking them.

## Scripts

```sh
npm run dev          # frontend + push server
npm run build        # typecheck + production frontend build
npm run preview      # build, then serve the built app from Express
npm run test         # unit tests
npm run lint         # eslint
npm run push:keys    # generate VAPID keys for Web Push
```

## Current MVP

- Pushups only
- Configurable rep range, default `1-20`
- Configurable notification hours, default `9 AM-5 PM`
- Random rep roll
- Completion logging
- Today and seven-day stats
- Real Web Push subscription flow with persisted subscriptions

## Deployment Notes

The frontend needs HTTPS for mobile installation and Web Push outside local development. The Express server also needs to stay running so its hourly scheduler can send reminders. For a low-cost friend-group deployment, use a static host for the Vite build plus a small Node host for the server, or serve `dist` directly from the Express server with `npm run preview`.
