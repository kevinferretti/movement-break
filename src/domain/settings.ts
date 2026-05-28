export type MovementSettings = {
  repMin: number
  repMax: number
}

export const REP_LIMITS = {
  min: 1,
  max: 500,
}

export function createDefaultSettings(): MovementSettings {
  return {
    repMin: 1,
    repMax: 20,
  }
}

export function normalizeSettings(
  input: Partial<MovementSettings> | null | undefined,
  fallback = createDefaultSettings(),
): MovementSettings {
  const repMin = clampInteger(input?.repMin, REP_LIMITS.min, REP_LIMITS.max, fallback.repMin)
  const repMax = clampInteger(input?.repMax, REP_LIMITS.min, REP_LIMITS.max, fallback.repMax)
  const min = Math.min(repMin, repMax)
  const max = Math.max(repMin, repMax)

  return {
    repMin: min,
    repMax: max,
  }
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)))
}
