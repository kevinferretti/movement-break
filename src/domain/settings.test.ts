import { describe, expect, it } from 'vitest'
import { createDefaultSettings, normalizeSettings } from './settings'

describe('settings', () => {
  it('keeps the default pushup rep range at 1 through 20', () => {
    expect(createDefaultSettings()).toMatchObject({
      repMin: 1,
      repMax: 20,
    })
  })

  it('normalizes reversed rep ranges', () => {
    const settings = normalizeSettings(
      { repMin: 20, repMax: 4 },
      createDefaultSettings(),
    )

    expect(settings.repMin).toBe(4)
    expect(settings.repMax).toBe(20)
  })
})
