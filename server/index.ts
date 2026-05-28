import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeSettings } from '../src/domain/settings.ts'
import type { PushSubscription as WebPushSubscription } from 'web-push'
import {
  configureWebPush,
  isPushConfigured,
  sendTestNotification,
  startHourlyPushScheduler,
  type PushConfig,
} from './pushScheduler.ts'
import { SubscriptionStore } from './store.ts'

const port = Number(process.env.PORT || 8787)
const dataFile = path.resolve(process.env.DATA_FILE || './data/subscriptions.json')
const store = new SubscriptionStore(dataFile)
const pushConfig: Partial<PushConfig> = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT || 'mailto:you@example.com',
}

if (isPushConfigured(pushConfig)) {
  configureWebPush(pushConfig)
} else {
  console.warn('Web Push is not configured. Run `npm run push:keys` and populate .env.')
}

const app = express()
const clientOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (clientOrigins.length > 0) {
  app.use(cors({ origin: clientOrigins }))
}

app.use(express.json({ limit: '64kb' }))

app.get('/api/health', async (_request, response) => {
  response.json({
    ok: true,
    pushConfigured: isPushConfigured(pushConfig),
    subscriptionCount: (await store.all()).length,
  })
})

app.get('/api/vapid-public-key', (_request, response) => {
  response.json({
    pushConfigured: isPushConfigured(pushConfig),
    publicKey: pushConfig.publicKey ?? null,
  })
})

app.post('/api/subscriptions', async (request, response) => {
  if (!isPushConfigured(pushConfig)) {
    response.status(503).json({ error: 'Push notifications are not configured on the server.' })
    return
  }

  const subscription = request.body?.subscription as Partial<WebPushSubscription> | undefined

  if (!subscription?.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
    response.status(400).json({ error: 'A valid push subscription is required.' })
    return
  }

  const settings = normalizeSettings(request.body?.settings)
  const validSubscription: WebPushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
  }

  await store.upsert(validSubscription.endpoint, {
    endpoint: validSubscription.endpoint,
    subscription: validSubscription,
    settings,
  })

  response.status(201).json({ ok: true })
})

app.delete('/api/subscriptions', async (request, response) => {
  const endpoint = request.body?.endpoint

  if (typeof endpoint !== 'string') {
    response.status(400).json({ error: 'Endpoint is required.' })
    return
  }

  await store.delete(endpoint)
  response.json({ ok: true })
})

app.post('/api/subscriptions/test', async (request, response) => {
  if (!isPushConfigured(pushConfig)) {
    response.status(503).json({ error: 'Push notifications are not configured on the server.' })
    return
  }

  const endpoint = request.body?.endpoint

  if (typeof endpoint !== 'string') {
    response.status(400).json({ error: 'Endpoint is required.' })
    return
  }

  try {
    await sendTestNotification(store, endpoint)
    response.json({ ok: true })
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : 'Test notification failed.' })
  }
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(__dirname, '../dist')

if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^\/(?!api).*/, (_request, response) => {
    response.sendFile(path.join(clientDist, 'index.html'))
  })
}

const task = startHourlyPushScheduler(store)

app.listen(port, () => {
  console.log(`Movement Break server listening on http://localhost:${port}`)
})

process.on('SIGTERM', () => {
  task.stop()
})

process.on('SIGINT', () => {
  task.stop()
  process.exit(0)
})
