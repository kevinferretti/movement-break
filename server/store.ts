import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StoredPushSubscription, SubscriptionStoreShape } from './types.ts'

const DEFAULT_STORE: SubscriptionStoreShape = { subscriptions: [] }

export class SubscriptionStore {
  private writeQueue = Promise.resolve()
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async all() {
    return (await this.read()).subscriptions
  }

  async find(endpoint: string) {
    return (await this.all()).find((subscription) => subscription.endpoint === endpoint) ?? null
  }

  async upsert(
    endpoint: string,
    value: Omit<StoredPushSubscription, 'createdAt' | 'updatedAt' | 'failureCount' | 'lastNotifiedHourKey'>,
  ) {
    return this.update((store) => {
      const now = new Date().toISOString()
      const existingIndex = store.subscriptions.findIndex((subscription) => subscription.endpoint === endpoint)
      const existing = existingIndex >= 0 ? store.subscriptions[existingIndex] : null
      const next: StoredPushSubscription = {
        ...value,
        endpoint,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastNotifiedHourKey: existing?.lastNotifiedHourKey ?? null,
        failureCount: existing?.failureCount ?? 0,
      }

      if (existingIndex >= 0) {
        store.subscriptions[existingIndex] = next
      } else {
        store.subscriptions.push(next)
      }

      return next
    })
  }

  async patch(endpoint: string, patch: Partial<StoredPushSubscription>) {
    return this.update((store) => {
      const existingIndex = store.subscriptions.findIndex((subscription) => subscription.endpoint === endpoint)

      if (existingIndex < 0) {
        return null
      }

      const next = {
        ...store.subscriptions[existingIndex],
        ...patch,
        endpoint,
        updatedAt: new Date().toISOString(),
      }

      store.subscriptions[existingIndex] = next
      return next
    })
  }

  async delete(endpoint: string) {
    return this.update((store) => {
      const before = store.subscriptions.length
      store.subscriptions = store.subscriptions.filter((subscription) => subscription.endpoint !== endpoint)

      return store.subscriptions.length !== before
    })
  }

  private async update<T>(mutator: (store: SubscriptionStoreShape) => T) {
    const run = async () => {
      const store = await this.read()
      const result = mutator(store)
      await this.write(store)

      return result
    }

    const result = this.writeQueue.then(run, run)
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    )

    return result
  }

  private async read(): Promise<SubscriptionStoreShape> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as SubscriptionStoreShape

      if (!Array.isArray(parsed.subscriptions)) {
        return { ...DEFAULT_STORE }
      }

      return parsed
    } catch (error) {
      if (isMissingFileError(error)) {
        return { ...DEFAULT_STORE }
      }

      throw error
    }
  }

  private async write(store: SubscriptionStoreShape) {
    const directory = path.dirname(this.filePath)
    await mkdir(directory, { recursive: true })

    const tempPath = `${this.filePath}.${process.pid}.tmp`
    await writeFile(tempPath, JSON.stringify(store, null, 2), 'utf8')
    await rename(tempPath, this.filePath)
  }
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}
