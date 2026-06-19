import { describe, expect, it } from 'vitest'
import { createDefaultPreferences, normalizePreferences } from './preferences'

describe('preferences', () => {
  it('defaults the direct rep preset to twenty', () => {
    expect(createDefaultPreferences()).toEqual({
      directReps: 20,
      enabledMovements: {
        pullups: true,
        pushups: true,
      },
    })
  })

  it('normalizes direct rep presets to a practical positive integer', () => {
    expect(normalizePreferences({ directReps: 0 }).directReps).toBe(1)
    expect(normalizePreferences({ directReps: 42.8 }).directReps).toBe(42)
    expect(normalizePreferences({ directReps: 900 }).directReps).toBe(500)
  })

  it('normalizes enabled movement toggles while keeping at least one movement on', () => {
    expect(
      normalizePreferences({
        enabledMovements: {
          pullups: true,
          pushups: true,
        },
      }).enabledMovements,
    ).toEqual({
      pullups: true,
      pushups: true,
    })

    expect(
      normalizePreferences({
        enabledMovements: {
          pullups: false,
          pushups: false,
        },
      }).enabledMovements,
    ).toEqual({
      pullups: true,
      pushups: true,
    })
  })
})
