import type { MovementEntry } from '../domain/stats'

const ENTRIES_KEY = 'movement-break.entries.v1'

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
