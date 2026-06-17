import { describe, expect, it } from 'vitest'
import { DEADLIFT_REPS, MOVEMENT_ROLL_CONFIGS, PULLUP_REPS, PUSHUP_REPS } from './reps'

describe('rep options', () => {
  it('allows three through eight pullups', () => {
    expect([...PULLUP_REPS]).toEqual([3, 4, 5, 6, 7, 8])
  })

  it('allows fifteen through thirty pushups', () => {
    expect([...PUSHUP_REPS]).toEqual([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30])
  })

  it('allows three through ten deadlifts', () => {
    expect([...DEADLIFT_REPS]).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('rolls pullups, pushups, or deadlifts', () => {
    expect(MOVEMENT_ROLL_CONFIGS.map((config) => config.movement)).toEqual(['pullups', 'pushups', 'deadlifts'])
  })
})
