import { createDefaultPreferences, normalizePreferences, type MovementPreferences } from '../domain/preferences'
import { isMovement } from '../domain/reps'
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

    const entries: MovementEntry[] = []

    for (const value of parsed) {
      const entry = normalizeMovementEntry(value)

      if (entry) {
        entries.push(entry)
      }
    }

    return entries
  } catch {
    return []
  }
}

export function saveEntries(entries: MovementEntry[]) {
  window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
}

function normalizeMovementEntry(value: unknown): MovementEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const entry = value as Partial<MovementEntry>
  const completedAt = typeof entry.completedAt === 'string' ? entry.completedAt : ''

  if (
    typeof entry.id === 'string' &&
    typeof entry.reps === 'number' &&
    Number.isFinite(entry.reps) &&
    !Number.isNaN(new Date(completedAt).getTime())
  ) {
    return {
      id: entry.id,
      movement: isMovement(entry.movement) ? entry.movement : 'pushups',
      reps: entry.reps,
      completedAt,
    }
  }

  return null
}
