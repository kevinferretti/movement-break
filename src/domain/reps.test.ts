import { describe, expect, it } from 'vitest'
import { AVAILABLE_REPS, REP_OPTIONS_LABEL } from './reps'

describe('rep options', () => {
  it('allows one through ten plus twenty', () => {
    expect([...AVAILABLE_REPS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20])
  })

  it('labels the available reps without implying eleven through nineteen are possible', () => {
    expect(REP_OPTIONS_LABEL).toBe('1-10, 20')
  })
})
