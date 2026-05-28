export const APP_UPDATE_AVAILABLE_EVENT = 'movement-break:update-available'

export type AppUpdateAvailableEvent = CustomEvent<{
  refresh: () => void
}>

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000
const UPDATE_READY_MESSAGE = 'MOVEMENT_BREAK_UPDATE_READY'

export function registerAppUpdateWatcher() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    return
  }

  let hasControlledPage = Boolean(navigator.serviceWorker.controller)
  let hasAnnouncedUpdate = false

  function refresh() {
    window.location.reload()
  }

  function announceUpdateAvailable() {
    if (hasAnnouncedUpdate) {
      return
    }

    hasAnnouncedUpdate = true
    window.dispatchEvent(
      new CustomEvent(APP_UPDATE_AVAILABLE_EVENT, {
        detail: { refresh },
      }),
    )
  }

  function watchInstallingWorker(worker: ServiceWorker | null) {
    if (!worker) {
      return
    }

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        announceUpdateAvailable()
      }
    })
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (hasControlledPage && event.data?.type === UPDATE_READY_MESSAGE) {
      announceUpdateAvailable()
    }
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          announceUpdateAvailable()
        }

        registration.addEventListener('updatefound', () => {
          watchInstallingWorker(registration.installing)
        })

        function checkForUpdate() {
          void registration.update().catch(() => undefined)
        }

        checkForUpdate()
        window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            checkForUpdate()
          }
        })
      })
      .catch(() => undefined)
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasControlledPage) {
      announceUpdateAvailable()
    }

    hasControlledPage = true
  })
}
