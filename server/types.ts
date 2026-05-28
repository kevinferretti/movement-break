import type { MovementSettings } from '../src/domain/settings.ts'
import type { PushSubscription as WebPushSubscription } from 'web-push'

export type StoredPushSubscription = {
  endpoint: string
  subscription: WebPushSubscription
  settings: MovementSettings
  createdAt: string
  updatedAt: string
  lastNotifiedHourKey: string | null
  lastNotificationAttemptAt?: string | null
  lastNotificationSuccessAt?: string | null
  lastNotificationError?: string | null
  failureCount: number
}

export type SubscriptionStoreShape = {
  subscriptions: StoredPushSubscription[]
}
