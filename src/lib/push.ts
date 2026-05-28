import type { MovementSettings } from '../domain/settings'

export type PushServerStatus = {
  pushConfigured: boolean
  publicKey: string | null
}

export type PushClientStatus = {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  endpoint: string | null
}

type SubscriptionPayload = {
  subscription: PushSubscriptionJSON
  settings: MovementSettings
}

export async function getPushClientStatus(): Promise<PushClientStatus> {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      endpoint: null,
    }
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()

  return {
    supported: true,
    permission: Notification.permission,
    endpoint: subscription?.endpoint ?? null,
  }
}

export async function getPushServerStatus(): Promise<PushServerStatus> {
  const response = await fetch('/api/vapid-public-key')

  if (!response.ok) {
    throw new Error('Push server is unavailable.')
  }

  return response.json() as Promise<PushServerStatus>
}

export async function subscribeToBreakNotifications(settings: MovementSettings) {
  if (!isPushSupported()) {
    throw new Error('This browser does not support web push.')
  }

  const serverStatus = await getPushServerStatus()

  if (!serverStatus.pushConfigured || !serverStatus.publicKey) {
    throw new Error('Push notifications are not configured on the server.')
  }

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await registerServiceWorker()
  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(serverStatus.publicKey),
    }))

  await saveSubscription({
    subscription: subscription.toJSON(),
    settings: {
      ...settings,
      notificationsEnabled: true,
    },
  })

  return subscription.endpoint
}

export async function syncBreakNotificationSettings(settings: MovementSettings) {
  if (!isPushSupported()) {
    return null
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()

  if (!subscription) {
    return null
  }

  await saveSubscription({
    subscription: subscription.toJSON(),
    settings,
  })

  return subscription.endpoint
}

export async function unsubscribeFromBreakNotifications() {
  if (!isPushSupported()) {
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()

  if (!subscription) {
    return
  }

  await fetch('/api/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  await subscription.unsubscribe()
}

export async function sendTestBreakNotification() {
  if (!isPushSupported()) {
    throw new Error('This browser does not support web push.')
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()

  if (!subscription) {
    throw new Error('Notifications are not enabled on this device.')
  }

  const response = await fetch('/api/subscriptions/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error || 'Test notification failed.')
  }
}

async function saveSubscription(payload: SubscriptionPayload) {
  const response = await fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error || 'Could not save notification settings.')
  }
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  return registration
}

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}
