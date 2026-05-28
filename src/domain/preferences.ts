export type MovementPreferences = {
  directReps: number
}

export const DIRECT_REP_LIMITS = {
  min: 1,
  max: 500,
}

export function createDefaultPreferences(): MovementPreferences {
  return {
    directReps: 20,
  }
}

export function normalizePreferences(
  input: Partial<MovementPreferences> | null | undefined,
  fallback = createDefaultPreferences(),
): MovementPreferences {
  return {
    directReps: clampInteger(input?.directReps, DIRECT_REP_LIMITS.min, DIRECT_REP_LIMITS.max, fallback.directReps),
  }
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)))
}
