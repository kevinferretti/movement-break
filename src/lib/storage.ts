import { createDefaultPreferences, normalizePreferences, type MovementPreferences } from '../domain/preferences'
import type { MovementEntry } from '../domain/stats'

const ENTRIES_KEY = 'movement-break.entries.v1'
const PREFERENCES_KEY = 'movement-break.preferences.v1'

export function loadPreferences(): MovementPreferences {
  const fallback = createDefaultPreferences()

  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY)
    return normalizePreferences(raw ? JSON.parse(raw) : null, fallback)
  } catch {
    return fallback
  }
}

export function savePreferences(preferences: MovementPreferences) {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
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
