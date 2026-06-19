import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isMovement, type Movement } from '../src/domain/reps'
import type { MovementEntry } from '../src/domain/stats'

export type AuthProvider = 'github' | 'google'

export type UserRecord = {
  id: string
  displayName: string
  avatarUrl: string | null
  email: string | null
  providers: ProviderIdentity[]
  createdAt: string
  updatedAt: string
  importedLocalEntriesAt: string | null
  importedLocalEntryCount: number
}

export type ProviderIdentity = {
  provider: AuthProvider
  providerUserId: string
  username: string | null
  email: string | null
}

export type SessionRecord = {
  tokenHash: string
  userId: string
  createdAt: string
  expiresAt: string
}

export type StoredMovementEntry = MovementEntry & {
  userId: string
  source: 'completion' | 'local_import'
  sourceEntryId: string | null
  createdAt: string
}

export type DatabaseFile = {
  version: 1
  users: UserRecord[]
  sessions: SessionRecord[]
  entries: StoredMovementEntry[]
}

export type OAuthProfile = {
  provider: AuthProvider
  providerUserId: string
  displayName: string
  avatarUrl: string | null
  username: string | null
  email: string | null
}

const MAX_IMPORT_ENTRIES = 5000
const REP_LIMITS = {
  min: 1,
  max: 500,
}

export class ValidationError extends Error {
  readonly status = 400
}

export class JsonDataStore {
  private readonly filePath: string
  private writeChain: Promise<unknown> = Promise.resolve()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async read() {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      return normalizeData(JSON.parse(raw))
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return createEmptyData()
      }

      throw error
    }
  }

  async update<Result>(mutator: (data: DatabaseFile) => Result | Promise<Result>) {
    const run = this.writeChain.then(async () => {
      const data = await this.read()
      const result = await mutator(data)

      await this.write(data)

      return result
    })

    this.writeChain = run.catch(() => undefined)

    return run
  }

  private async write(data: DatabaseFile) {
    await mkdir(path.dirname(this.filePath), { recursive: true })

    const tempFile = `${this.filePath}.${randomUUID()}.tmp`
    await writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    await rename(tempFile, this.filePath)
  }
}

export function createEmptyData(): DatabaseFile {
  return {
    version: 1,
    users: [],
    sessions: [],
    entries: [],
  }
}

export function upsertUserFromOAuth(data: DatabaseFile, profile: OAuthProfile, now = new Date()) {
  const timestamp = now.toISOString()
  const providerUserId = String(profile.providerUserId)
  const existingUser = data.users.find((user) =>
    user.providers.some(
      (identity) => identity.provider === profile.provider && identity.providerUserId === providerUserId,
    ),
  )

  if (existingUser) {
    existingUser.displayName = profile.displayName
    existingUser.avatarUrl = profile.avatarUrl
    existingUser.email = profile.email ?? existingUser.email
    existingUser.updatedAt = timestamp
    existingUser.providers = existingUser.providers.map((identity) =>
      identity.provider === profile.provider && identity.providerUserId === providerUserId
        ? createProviderIdentity(profile)
        : identity,
    )

    return existingUser
  }

  const user: UserRecord = {
    id: randomUUID(),
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    email: profile.email,
    providers: [createProviderIdentity(profile)],
    createdAt: timestamp,
    updatedAt: timestamp,
    importedLocalEntriesAt: null,
    importedLocalEntryCount: 0,
  }

  data.users.push(user)

  return user
}

export function createStoredEntry(
  userId: string,
  movement: Movement,
  reps: number,
  source: StoredMovementEntry['source'],
  completedAt = new Date(),
) {
  return {
    id: randomUUID(),
    movement,
    reps: parseReps(reps),
    completedAt: completedAt.toISOString(),
    userId,
    source,
    sourceEntryId: null,
    createdAt: new Date().toISOString(),
  }
}

export function importLocalEntries(data: DatabaseFile, userId: string, rawEntries: unknown, now = new Date()) {
  const user = data.users.find((candidate) => candidate.id === userId)

  if (!user) {
    throw new ValidationError('User not found.')
  }

  if (user.importedLocalEntriesAt) {
    return {
      imported: false,
      importedCount: 0,
      entries: getUserEntries(data, userId),
      user,
    }
  }

  const importedEntries = normalizeImportedEntries(rawEntries, now).map((entry) => ({
    id: randomUUID(),
    movement: entry.movement,
    reps: entry.reps,
    completedAt: entry.completedAt,
    userId,
    source: 'local_import' as const,
    sourceEntryId: entry.id,
    createdAt: now.toISOString(),
  }))

  data.entries.unshift(...importedEntries)
  user.importedLocalEntriesAt = now.toISOString()
  user.importedLocalEntryCount = importedEntries.length
  user.updatedAt = now.toISOString()

  return {
    imported: true,
    importedCount: importedEntries.length,
    entries: getUserEntries(data, userId),
    user,
  }
}

export function getUserEntries(data: DatabaseFile, userId: string) {
  return data.entries
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
}

export function normalizeImportedEntries(rawEntries: unknown, now = new Date()): MovementEntry[] {
  if (!Array.isArray(rawEntries)) {
    throw new ValidationError('Entries must be an array.')
  }

  if (rawEntries.length > MAX_IMPORT_ENTRIES) {
    throw new ValidationError(`Cannot import more than ${MAX_IMPORT_ENTRIES} entries.`)
  }

  const seenIds = new Set<string>()
  const maxCompletedAt = now.getTime() + 5 * 60 * 1000

  return rawEntries.map((rawEntry) => {
    if (!rawEntry || typeof rawEntry !== 'object') {
      throw new ValidationError('Invalid entry.')
    }

    const entry = rawEntry as Partial<MovementEntry>
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    const completedAt = new Date(String(entry.completedAt))

    if (!id || seenIds.has(id)) {
      throw new ValidationError('Entries must have unique ids.')
    }

    const movement = parseMovement(entry.movement ?? 'pushups')

    if (Number.isNaN(completedAt.getTime()) || completedAt.getTime() > maxCompletedAt) {
      throw new ValidationError('Entries must have valid completion dates.')
    }

    seenIds.add(id)

    return {
      id,
      movement,
      reps: parseReps(entry.reps),
      completedAt: completedAt.toISOString(),
    }
  })
}

export function parseReps(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed)) {
    throw new ValidationError('Reps must be a number.')
  }

  const reps = Math.trunc(parsed)

  if (reps < REP_LIMITS.min || reps > REP_LIMITS.max) {
    throw new ValidationError(`Reps must be between ${REP_LIMITS.min} and ${REP_LIMITS.max}.`)
  }

  return reps
}

export function parseMovement(value: unknown) {
  if (isMovement(value)) {
    return value
  }

  throw new ValidationError('Movement must be pushups or pullups.')
}

function createProviderIdentity(profile: OAuthProfile): ProviderIdentity {
  return {
    provider: profile.provider,
    providerUserId: String(profile.providerUserId),
    username: profile.username,
    email: profile.email,
  }
}

function normalizeData(raw: unknown): DatabaseFile {
  if (!raw || typeof raw !== 'object') {
    return createEmptyData()
  }

  const data = raw as Partial<DatabaseFile>

  return {
    version: 1,
    users: Array.isArray(data.users) ? data.users.filter(isUserRecord) : [],
    sessions: Array.isArray(data.sessions) ? data.sessions.filter(isSessionRecord) : [],
    entries: Array.isArray(data.entries) ? data.entries.filter(isStoredMovementEntry) : [],
  }
}

function isUserRecord(value: unknown): value is UserRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const user = value as Partial<UserRecord>

  return (
    typeof user.id === 'string' &&
    typeof user.displayName === 'string' &&
    Array.isArray(user.providers) &&
    typeof user.createdAt === 'string' &&
    typeof user.updatedAt === 'string'
  )
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const session = value as Partial<SessionRecord>

  return (
    typeof session.tokenHash === 'string' &&
    typeof session.userId === 'string' &&
    typeof session.createdAt === 'string' &&
    typeof session.expiresAt === 'string'
  )
}

function isStoredMovementEntry(value: unknown): value is StoredMovementEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entry = value as Partial<StoredMovementEntry>

  return (
    typeof entry.id === 'string' &&
    isMovement(entry.movement) &&
    typeof entry.reps === 'number' &&
    Number.isFinite(entry.reps) &&
    typeof entry.completedAt === 'string' &&
    typeof entry.userId === 'string' &&
    !Number.isNaN(new Date(entry.completedAt).getTime())
  )
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
