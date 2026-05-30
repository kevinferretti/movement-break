import 'dotenv/config'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  JsonDataStore,
  ValidationError,
  createStoredEntry,
  getUserEntries,
  importLocalEntries,
  parseMovement,
  parseReps,
  upsertUserFromOAuth,
  type StoredMovementEntry,
  type UserRecord,
} from './dataStore'
import { createAuthorizationUrl, exchangeOAuthCode, getEnabledProviders, isAuthProvider } from './oauth'

const port = Number(process.env.PORT || 8787)
const app = express()
const publicUrl = process.env.PUBLIC_URL || process.env.CLIENT_ORIGIN?.split(',')[0] || `http://localhost:${port}`
const dataFile = process.env.DATA_FILE || path.resolve(process.cwd(), '.data/movement-break.json')
const store = new JsonDataStore(dataFile)
const clientOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const sessionCookieName = 'movement_break_session'
const oauthStateCookieName = 'movement_break_oauth_state'
const sessionMaxAgeMs = 90 * 24 * 60 * 60 * 1000

if (clientOrigins.length > 0) {
  app.use(cors({ origin: clientOrigins, credentials: true }))
}

app.use(express.json({ limit: '64kb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
  })
})

app.get('/api/auth/config', (_request, response) => {
  response.json({
    providers: getEnabledProviders(),
  })
})

app.get('/api/auth/:provider/start', (request, response) => {
  const provider = getRouteParam(request, 'provider')

  if (!provider || !isAuthProvider(provider)) {
    response.status(404).json({ error: 'Unknown auth provider.' })
    return
  }

  if (!getEnabledProviders().includes(provider)) {
    response.status(503).json({ error: `${provider} login is not configured.` })
    return
  }

  const state = randomToken(24)

  appendCookie(response, oauthStateCookieName, `${provider}:${state}`, {
    httpOnly: true,
    maxAgeSeconds: 10 * 60,
  })
  response.redirect(createAuthorizationUrl(provider, state, publicUrl))
})

app.get(
  '/api/auth/:provider/callback',
  asyncRoute(async (request, response) => {
    const provider = getRouteParam(request, 'provider')
    const code = typeof request.query.code === 'string' ? request.query.code : ''
    const state = typeof request.query.state === 'string' ? request.query.state : ''

    if (!provider || !isAuthProvider(provider)) {
      response.status(404).json({ error: 'Unknown auth provider.' })
      return
    }

    if (!code || !state || getCookie(request, oauthStateCookieName) !== `${provider}:${state}`) {
      response.status(400).json({ error: 'Invalid OAuth callback.' })
      return
    }

    const profile = await exchangeOAuthCode(provider, code, publicUrl)
    const sessionToken = randomToken(32)
    const sessionHash = hashToken(sessionToken)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + sessionMaxAgeMs)

    await store.update((data) => {
      const user = upsertUserFromOAuth(data, profile, now)

      data.sessions.push({
        tokenHash: sessionHash,
        userId: user.id,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      })
    })

    appendCookie(response, sessionCookieName, sessionToken, {
      httpOnly: true,
      maxAgeSeconds: Math.floor(sessionMaxAgeMs / 1000),
    })
    clearCookie(response, oauthStateCookieName)
    response.redirect(publicUrl)
  }),
)

app.get(
  '/api/me',
  asyncRoute(async (request, response) => {
    const user = await loadAuthenticatedUser(request)

    response.json({
      user: user ? serializeUser(user) : null,
    })
  }),
)

app.post(
  '/api/auth/logout',
  asyncRoute(async (request, response) => {
    const sessionToken = getCookie(request, sessionCookieName)

    if (sessionToken) {
      const sessionHash = hashToken(sessionToken)
      await store.update((data) => {
        data.sessions = data.sessions.filter((session) => session.tokenHash !== sessionHash)
      })
    }

    clearCookie(response, sessionCookieName)
    response.json({ ok: true })
  }),
)

app.get(
  '/api/stats/entries',
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request, response)

    if (!user) {
      return
    }

    const data = await store.read()

    response.json({
      entries: getUserEntries(data, user.id).map(serializeEntry),
    })
  }),
)

app.post(
  '/api/stats/entries',
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request, response)

    if (!user) {
      return
    }

    const movement = parseMovement(request.body?.movement ?? 'pushups')
    const reps = parseReps(request.body?.reps)
    const entry = await store.update((data) => {
      const storedEntry = createStoredEntry(user.id, movement, reps, 'completion')

      data.entries.unshift(storedEntry)

      return storedEntry
    })

    response.status(201).json({
      entry: serializeEntry(entry),
    })
  }),
)

app.post(
  '/api/stats/import-local',
  asyncRoute(async (request, response) => {
    const user = await requireAuthenticatedUser(request, response)

    if (!user) {
      return
    }

    const result = await store.update((data) => importLocalEntries(data, user.id, request.body?.entries ?? []))

    response.json({
      imported: result.imported,
      importedCount: result.importedCount,
      entries: result.entries.map(serializeEntry),
      user: serializeUser(result.user),
    })
  }),
)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(__dirname, '../dist')

if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^\/(?!api).*/, (_request, response) => {
    response.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.use((error: Error, _request: Request, response: Response, next: NextFunction) => {
  if (response.headersSent) {
    next(error)
    return
  }

  if (error instanceof ValidationError) {
    response.status(error.status).json({ error: error.message })
    return
  }

  console.error(error)
  response.status(500).json({ error: 'Unexpected server error.' })
})

app.listen(port, () => {
  console.log(`Movement Break server listening on http://localhost:${port}`)
})

process.on('SIGINT', () => {
  process.exit(0)
})

function asyncRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response, next).catch(next)
  }
}

async function requireAuthenticatedUser(request: Request, response: Response) {
  const user = await loadAuthenticatedUser(request)

  if (!user) {
    response.status(401).json({ error: 'Sign in required.' })
    return null
  }

  return user
}

async function loadAuthenticatedUser(request: Request) {
  const sessionToken = getCookie(request, sessionCookieName)

  if (!sessionToken) {
    return null
  }

  const sessionHash = hashToken(sessionToken)
  const now = Date.now()

  return store.update((data) => {
    data.sessions = data.sessions.filter((session) => Date.parse(session.expiresAt) > now)

    const session = data.sessions.find((candidate) => candidate.tokenHash === sessionHash)

    if (!session) {
      return null
    }

    return data.users.find((user) => user.id === session.userId) ?? null
  })
}

function serializeUser(user: UserRecord) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    providers: user.providers.map((provider) => provider.provider),
    importedLocalEntriesAt: user.importedLocalEntriesAt,
    importedLocalEntryCount: user.importedLocalEntryCount,
  }
}

function serializeEntry(entry: StoredMovementEntry) {
  return {
    id: entry.id,
    movement: entry.movement,
    reps: entry.reps,
    completedAt: entry.completedAt,
  }
}

function randomToken(byteLength: number) {
  return randomBytes(byteLength).toString('base64url')
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

function getCookie(request: Request, name: string) {
  const cookies = request.headers.cookie?.split(';') ?? []

  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=')

    if (rawName === name) {
      return decodeURIComponent(rawValue.join('='))
    }
  }

  return null
}

function getRouteParam(request: Request, name: string) {
  const value = request.params[name]

  return Array.isArray(value) ? value[0] : value
}

function appendCookie(
  response: Response,
  name: string,
  value: string,
  options: { httpOnly: boolean; maxAgeSeconds: number },
) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${options.maxAgeSeconds}`,
  ]

  if (options.httpOnly) {
    attributes.push('HttpOnly')
  }

  if (publicUrl.startsWith('https://')) {
    attributes.push('Secure')
  }

  response.append('Set-Cookie', attributes.join('; '))
}

function clearCookie(response: Response, name: string) {
  appendCookie(response, name, '', {
    httpOnly: true,
    maxAgeSeconds: 0,
  })
}
