import { formatDateKey } from './time'
import type { Movement } from './reps'

export type MovementEntry = {
  id: string
  movement: Movement
  reps: number
  completedAt: string
}

export type DailyTotal = {
  dateKey: string
  reps: number
  breaks: number
}

export function summarizeEntries(entries: MovementEntry[], now = new Date()) {
  const todayKey = formatDateKey(now)
  const todayEntries = entries.filter((entry) => formatDateKey(new Date(entry.completedAt)) === todayKey)
  const todayReps = sumReps(todayEntries)
  const totalReps = sumReps(entries)
  const totalBreaks = entries.length

  return {
    todayReps,
    todayBreaks: todayEntries.length,
    averageToday: todayEntries.length === 0 ? 0 : Math.round(todayReps / todayEntries.length),
    totalReps,
    totalBreaks,
  }
}

export function buildDailyTotals(entries: MovementEntry[], days: number, now = new Date()): DailyTotal[] {
  const totals = new Map<string, DailyTotal>()

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - index)
    const dateKey = formatDateKey(date)
    totals.set(dateKey, { dateKey, reps: 0, breaks: 0 })
  }

  for (const entry of entries) {
    const dateKey = formatDateKey(new Date(entry.completedAt))
    const total = totals.get(dateKey)

    if (total) {
      total.reps += entry.reps
      total.breaks += 1
    }
  }

  return [...totals.values()]
}

export function createMovementEntry(movement: Movement, reps: number, completedAt = new Date()): MovementEntry {
  return {
    id: crypto.randomUUID(),
    movement,
    reps,
    completedAt: completedAt.toISOString(),
  }
}

function sumReps(entries: MovementEntry[]) {
  return entries.reduce((total, entry) => total + entry.reps, 0)
}
