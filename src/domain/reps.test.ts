import { describe, expect, it } from 'vitest'
import { MOVEMENT_ROLL_CONFIGS, PULLUP_REPS, PUSHUP_REPS } from './reps'

describe('rep options', () => {
  it('allows three through eight pullups', () => {
    expect([...PULLUP_REPS]).toEqual([3, 4, 5, 6, 7, 8])
  })

  it('allows five through twenty plus thirty pushups', () => {
    expect([...PUSHUP_REPS]).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 30])
  })

  it('rolls either pullups or pushups', () => {
    expect(MOVEMENT_ROLL_CONFIGS.map((config) => config.movement)).toEqual(['pullups', 'pushups'])
  })
})
