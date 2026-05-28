import cron from 'node-cron'
import { createHash } from 'node:crypto'
import webPush from 'web-push'
import { canNotifyAtHour } from '../src/domain/settings.ts'
import { getLocalHourParts } from '../src/domain/time.ts'
import type { SubscriptionStore } from './store.ts'
import type { StoredPushSubscription } from './types.ts'

export type PushConfig = {
  publicKey: string
  privateKey: string
  subject: string
}

export function isPushConfigured(config: Partial<PushConfig>): config is PushConfig {
  return Boolean(config.publicKey && config.privateKey && config.subject)
}

export function configureWebPush(config: PushConfig) {
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
}

export async function sendTestNotification(store: SubscriptionStore, endpoint: string) {
  const subscription = await store.find(endpoint)

  if (!subscription) {
    throw new Error('Subscription was not found.')
  }

  await sendNotification(subscription, {
    title: 'Movement break test',
    body: 'Push notifications are connected.',
    url: '/',
    tag: `movement-break-test-${Date.now()}`,
  })
}

export function startHourlyPushScheduler(store: SubscriptionStore) {
  return cron.schedule('0 * * * *', () => {
    void sendDueNotifications(store, new Date())
  })
}

export async function sendDueNotifications(store: SubscriptionStore, now: Date) {
  const subscriptions = await store.all()
  let attempted = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const localParts = getLocalHourParts(now, subscription.settings.timeZone)

      if (
        !canNotifyAtHour(subscription.settings, localParts.hour) ||
        subscription.lastNotifiedHourKey === localParts.hourKey
      ) {
        skipped += 1
        return
      }

      attempted += 1
      const attemptedAt = now.toISOString()

      try {
        await store.patch(subscription.endpoint, {
          lastNotificationAttemptAt: attemptedAt,
          lastNotificationError: null,
        })
        await sendNotification(subscription, {
          title: 'Movement break',
          body: 'Roll your pushups.',
          url: '/',
          tag: `movement-break-${localParts.hourKey}`,
        })
        await store.patch(subscription.endpoint, {
          lastNotifiedHourKey: localParts.hourKey,
          lastNotificationSuccessAt: new Date().toISOString(),
          lastNotificationError: null,
          failureCount: 0,
        })
        sent += 1
        console.info('Sent movement break notification', {
          subscription: describeSubscription(subscription),
          hourKey: localParts.hourKey,
          timeZone: subscription.settings.timeZone,
        })
      } catch (error) {
        if (isExpiredSubscription(error)) {
          await store.delete(subscription.endpoint)
          failed += 1
          console.warn('Removed expired movement break subscription', {
            subscription: describeSubscription(subscription),
            hourKey: localParts.hourKey,
          })
          return
        }

        failed += 1
        await store.patch(subscription.endpoint, {
          failureCount: subscription.failureCount + 1,
          lastNotificationError: getErrorMessage(error),
        })
        console.error('Failed to send movement break notification', error)
      }
    }),
  )

  if (subscriptions.length > 0) {
    console.info('Movement break scheduler tick', {
      now: now.toISOString(),
      subscriptions: subscriptions.length,
      attempted,
      sent,
      skipped,
      failed,
    })
  }
}

async function sendNotification(
  subscription: StoredPushSubscription,
  payload: {
    title: string
    body: string
    url: string
    tag: string
  },
) {
  await webPush.sendNotification(subscription.subscription, JSON.stringify(payload))
}

function isExpiredSubscription(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) {
    return false
  }

  return error.statusCode === 404 || error.statusCode === 410
}

function describeSubscription(subscription: StoredPushSubscription) {
  return {
    host: new URL(subscription.endpoint).host,
    id: createHash('sha256').update(subscription.endpoint).digest('hex').slice(0, 10),
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown push notification error'
}
