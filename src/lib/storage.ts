import { createDefaultSettings, normalizeSettings, type MovementSettings } from '../domain/settings'
import type { MovementEntry } from '../domain/stats'

const SETTINGS_KEY = 'movement-break.settings.v1'
const ENTRIES_KEY = 'movement-break.entries.v1'

export function loadSettings(): MovementSettings {
  const fallback = createDefaultSettings()

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    return normalizeSettings(raw ? JSON.parse(raw) : null, fallback)
  } catch {
    return fallback
  }
}

export function saveSettings(settings: MovementSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadEntries(): MovementEntry[] {
  try {
    const raw = window.localStorage.getItem(ENTRIES_KEY)
    const parsed = raw ? JSON.parse(raw) : []

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isMovementEntry)
  } catch {
    return []
  }
}

export function saveEntries(entries: MovementEntry[]) {
  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
}

function isMovementEntry(value: unknown): value is MovementEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entry = value as Partial<MovementEntry>

  return (
    typeof entry.id === 'string' &&
    entry.movement === 'pushups' &&
    typeof entry.reps === 'number' &&
    Number.isFinite(entry.reps) &&
    typeof entry.completedAt === 'string' &&
    !Number.isNaN(new Date(entry.completedAt).getTime())
  )
}
