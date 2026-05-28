import { describe, expect, it } from 'vitest'
import { createDefaultPreferences, normalizePreferences } from './preferences'

describe('preferences', () => {
  it('defaults the direct rep preset to twenty', () => {
    expect(createDefaultPreferences()).toEqual({
      directReps: 20,
    })
  })

  it('normalizes direct rep presets to a practical positive integer', () => {
    expect(normalizePreferences({ directReps: 0 }).directReps).toBe(1)
    expect(normalizePreferences({ directReps: 42.8 }).directReps).toBe(42)
    expect(normalizePreferences({ directReps: 900 }).directReps).toBe(500)
  })
})
