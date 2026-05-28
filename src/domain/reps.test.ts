import { describe, expect, it } from 'vitest'
import { AVAILABLE_REPS } from './reps'

describe('rep options', () => {
  it('allows one through ten plus twenty', () => {
    expect([...AVAILABLE_REPS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20])
  })
})
