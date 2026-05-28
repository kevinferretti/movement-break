import { isHourInWindow } from './time'

export type MovementSettings = {
  repMin: number
  repMax: number
  startHour: number
  endHour: number
  notificationsEnabled: boolean
  timeZone: string
}

export const REP_LIMITS = {
  min: 1,
  max: 500,
}

export function createDefaultSettings(timeZone = 'UTC'): MovementSettings {
  return {
    repMin: 1,
    repMax: 20,
    startHour: 9,
    endHour: 17,
    notificationsEnabled: false,
    timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC',
  }
}

export function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function normalizeSettings(
  input: Partial<MovementSettings> | null | undefined,
  fallback = createDefaultSettings(),
): MovementSettings {
  const repMin = clampInteger(input?.repMin, REP_LIMITS.min, REP_LIMITS.max, fallback.repMin)
  const repMax = clampInteger(input?.repMax, REP_LIMITS.min, REP_LIMITS.max, fallback.repMax)
  const min = Math.min(repMin, repMax)
  const max = Math.max(repMin, repMax)
  const startHour = clampInteger(input?.startHour, 0, 23, fallback.startHour)
  const endHour = clampInteger(input?.endHour, 0, 23, fallback.endHour)
  const timeZone =
    typeof input?.timeZone === 'string' && isValidTimeZone(input.timeZone)
      ? input.timeZone
      : fallback.timeZone

  return {
    repMin: min,
    repMax: max,
    startHour,
    endHour,
    notificationsEnabled: Boolean(input?.notificationsEnabled),
    timeZone,
  }
}

export function canNotifyAtHour(settings: MovementSettings, hour: number) {
  return settings.notificationsEnabled && isHourInWindow(hour, settings.startHour, settings.endHour)
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)))
}

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
    return true
  } catch {
    return false
  }
}
