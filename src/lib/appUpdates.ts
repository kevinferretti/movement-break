export const APP_UPDATE_AVAILABLE_EVENT = 'movement-break:update-available'

export type AppUpdateAvailableEvent = CustomEvent<{
  refresh: () => void
}>

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000
const UPDATE_READY_MESSAGE = 'MOVEMENT_BREAK_UPDATE_READY'
const SKIP_WAITING_MESSAGE = 'MOVEMENT_BREAK_SKIP_WAITING'

export function registerAppUpdateWatcher() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    return
  }

  let hasControlledPage = Boolean(navigator.serviceWorker.controller)
  let hasAnnouncedUpdate = false
  let isRefreshRequested = false
  let isReloading = false
  let updateRegistration: ServiceWorkerRegistration | null = null
  const currentAssetPaths = getDocumentAssetPaths(document)

  function refresh() {
    isRefreshRequested = true

    if (updateRegistration?.waiting) {
      updateRegistration.waiting.postMessage({ type: SKIP_WAITING_MESSAGE })
      window.setTimeout(reloadForUpdate, 2000)
      return
    }

    reloadForUpdate()
  }

  function reloadForUpdate() {
    if (isReloading) {
      return
    }

    isReloading = true
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

  async function checkForAppAssetUpdate() {
    const nextAssetPaths = await fetchCurrentDocumentAssetPaths()

    if (nextAssetPaths.length === 0) {
      return
    }

    if (!haveSameItems(currentAssetPaths, nextAssetPaths)) {
      announceUpdateAvailable()
    }
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
        updateRegistration = registration

        if (registration.waiting && navigator.serviceWorker.controller) {
          announceUpdateAvailable()
        }

        registration.addEventListener('updatefound', () => {
          watchInstallingWorker(registration.installing)
        })

        function checkForUpdate() {
          void registration.update().catch(() => undefined)
          void checkForAppAssetUpdate().catch(() => undefined)
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
    if (isRefreshRequested) {
      reloadForUpdate()
      return
    }

    if (hasControlledPage) {
      announceUpdateAvailable()
    }

    hasControlledPage = true
  })
}

function getDocumentAssetPaths(documentNode: Document) {
  const assetUrls = [
    ...Array.from(documentNode.querySelectorAll<HTMLScriptElement>('script[src]')).map((node) => node.src),
    ...Array.from(documentNode.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')).map(
      (node) => node.href,
    ),
  ]

  return assetUrls.map(normalizeAssetPath).filter((path): path is string => path !== null).sort()
}

function normalizeAssetPath(assetUrl: string) {
  try {
    const url = new URL(assetUrl, window.location.href)

    if (url.origin !== window.location.origin) {
      return null
    }

    return url.pathname
  } catch {
    return null
  }
}

async function fetchCurrentDocumentAssetPaths() {
  const url = new URL(window.location.href)
  url.searchParams.set('movement-break-update-check', String(Date.now()))

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      Accept: 'text/html',
    },
  })

  if (!response.ok) {
    return []
  }

  const html = await response.text()
  const documentNode = new DOMParser().parseFromString(html, 'text/html')

  return getDocumentAssetPaths(documentNode)
}

function haveSameItems(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index])
}
