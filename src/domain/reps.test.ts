import { describe, expect, it } from 'vitest'
import { AVAILABLE_REPS } from './reps'

describe('rep options', () => {
  it('allows five through twenty plus thirty', () => {
    expect([...AVAILABLE_REPS]).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 30])
  })
})
