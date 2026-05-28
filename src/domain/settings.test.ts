import { describe, expect, it } from 'vitest'
import { createDefaultSettings, normalizeSettings } from './settings'
import { isHourInWindow } from './time'

describe('settings', () => {
  it('keeps the default pushup rep range at 1 through 20', () => {
    expect(createDefaultSettings('America/Chicago')).toMatchObject({
      repMin: 1,
      repMax: 20,
      startHour: 9,
      endHour: 17,
    })
  })

  it('normalizes reversed rep ranges', () => {
    const settings = normalizeSettings(
      { repMin: 20, repMax: 4, timeZone: 'America/Chicago' },
      createDefaultSettings('America/Chicago'),
    )

    expect(settings.repMin).toBe(4)
    expect(settings.repMax).toBe(20)
  })

  it('supports notification windows that cross midnight', () => {
    expect(isHourInWindow(23, 22, 2)).toBe(true)
    expect(isHourInWindow(1, 22, 2)).toBe(true)
    expect(isHourInWindow(12, 22, 2)).toBe(false)
  })
})
