import { describe, expect, it } from 'vitest'
import { buildDailyTotals, summarizeEntries, type MovementEntry } from './stats'

describe('stats', () => {
  it('summarizes today separately from lifetime totals', () => {
    const entries: MovementEntry[] = [
      { id: '1', movement: 'pushups', reps: 10, completedAt: '2026-05-28T15:00:00.000Z' },
      { id: '2', movement: 'pushups', reps: 14, completedAt: '2026-05-28T16:00:00.000Z' },
      { id: '3', movement: 'pullups', reps: 8, completedAt: '2026-05-27T16:00:00.000Z' },
    ]

    expect(summarizeEntries(entries, new Date('2026-05-28T20:00:00.000Z'))).toMatchObject({
      todayReps: 24,
      todayBreaks: 2,
      averageToday: 12,
      totalReps: 32,
      totalBreaks: 3,
    })
  })

  it('builds a fixed day range for charts', () => {
    const entries: MovementEntry[] = [
      { id: '1', movement: 'pushups', reps: 7, completedAt: '2026-05-27T16:00:00.000Z' },
    ]

    expect(buildDailyTotals(entries, 3, new Date('2026-05-28T20:00:00.000Z'))).toEqual([
      { dateKey: '2026-05-26', reps: 0, breaks: 0 },
      { dateKey: '2026-05-27', reps: 7, breaks: 1 },
      { dateKey: '2026-05-28', reps: 0, breaks: 0 },
    ])
  })
})
