import type { Movement } from '../domain/reps'
import type { MovementEntry } from '../domain/stats'

export type AuthProvider = 'github' | 'google'

export type CurrentUser = {
  id: string
  displayName: string
  avatarUrl: string | null
  providers: AuthProvider[]
  importedLocalEntriesAt: string | null
  importedLocalEntryCount: number
}

export function fetchAuthConfig() {
  return requestJson<{ providers: AuthProvider[] }>('/api/auth/config')
}

export function fetchCurrentUser() {
  return requestJson<{ user: CurrentUser | null }>('/api/me')
}

export function fetchServerEntries() {
  return requestJson<{ entries: MovementEntry[] }>('/api/stats/entries')
}

export function subscribeToServerEntries({
  onEntry,
  onSync,
}: {
  onEntry: (payload: { entry: MovementEntry }) => void
  onSync: (payload: { entries: MovementEntry[] }) => void
}) {
  const events = new EventSource('/api/stats/entries/stream', { withCredentials: true })

  events.addEventListener('entry', (event) => {
    onEntry(readServerEvent<{ entry: MovementEntry }>(event))
  })

  events.addEventListener('sync', (event) => {
    onSync(readServerEvent<{ entries: MovementEntry[] }>(event))
  })

  return () => {
    events.close()
  }
}

export function importLocalEntriesToServer(entries: MovementEntry[]) {
  return requestJson<{
    imported: boolean
    importedCount: number
    entries: MovementEntry[]
    user: CurrentUser
  }>('/api/stats/import-local', {
    method: 'POST',
    body: JSON.stringify({ entries }),
  })
}

export function logServerEntry(movement: Movement, reps: number) {
  return requestJson<{ entry: MovementEntry }>('/api/stats/entries', {
    method: 'POST',
    body: JSON.stringify({ movement, reps }),
  })
}

export function logOut() {
  return requestJson<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
  })
}

async function requestJson<Result>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await readErrorBody(response)
    throw new Error(errorBody || `Request failed with ${response.status}.`)
  }

  return response.json() as Promise<Result>
}

function readServerEvent<Result>(event: Event) {
  return JSON.parse((event as MessageEvent<string>).data) as Result
}

async function readErrorBody(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown }

    return typeof body.error === 'string' ? body.error : ''
  } catch {
    return ''
  }
}
