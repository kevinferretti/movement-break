import type { Movement } from './reps'

export type MovementPreferences = {
  directReps: number
  enabledMovements: Record<Movement, boolean>
}
type MovementPreferencesInput = Partial<Omit<MovementPreferences, 'enabledMovements'>> & {
  enabledMovements?: Partial<Record<Movement, unknown>> | null
}

export const DIRECT_REP_LIMITS = {
  min: 1,
  max: 500,
}
export const DEFAULT_ENABLED_MOVEMENTS: Record<Movement, boolean> = {
  pullups: true,
  pushups: true,
}

export function createDefaultPreferences(): MovementPreferences {
  return {
    directReps: 20,
    enabledMovements: { ...DEFAULT_ENABLED_MOVEMENTS },
  }
}

export function normalizePreferences(
  input: MovementPreferencesInput | null | undefined,
  fallback = createDefaultPreferences(),
): MovementPreferences {
  return {
    directReps: clampInteger(input?.directReps, DIRECT_REP_LIMITS.min, DIRECT_REP_LIMITS.max, fallback.directReps),
    enabledMovements: normalizeEnabledMovements(input?.enabledMovements, fallback.enabledMovements),
  }
}

function normalizeEnabledMovements(
  value: Partial<Record<Movement, unknown>> | null | undefined,
  fallback: Record<Movement, boolean>,
) {
  const enabledMovements = {
    pullups: value?.pullups === undefined ? fallback.pullups : value.pullups === true,
    pushups: value?.pushups === undefined ? fallback.pushups : value.pushups === true,
  }

  if (Object.values(enabledMovements).some(Boolean)) {
    return enabledMovements
  }

  return fallback
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)))
}
