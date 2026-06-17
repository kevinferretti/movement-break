export type Movement = 'deadlifts' | 'pullups' | 'pushups'

export type MovementRollConfig = {
  movement: Movement
  reps: readonly number[]
}

export const PULLUP_REPS = [3, 4, 5, 6, 7, 8] as const
export const PUSHUP_REPS = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const
export const DEADLIFT_REPS = [3, 4, 5, 6, 7, 8, 9, 10] as const
export const AVAILABLE_REPS = PUSHUP_REPS

export const MOVEMENT_ROLL_CONFIGS: readonly MovementRollConfig[] = [
  { movement: 'pullups', reps: PULLUP_REPS },
  { movement: 'pushups', reps: PUSHUP_REPS },
  { movement: 'deadlifts', reps: DEADLIFT_REPS },
]

const MOVEMENT_LABELS: Record<Movement, string> = {
  deadlifts: 'Deadlifts',
  pullups: 'Pullups',
  pushups: 'Pushups',
}

export function isMovement(value: unknown): value is Movement {
  return value === 'deadlifts' || value === 'pullups' || value === 'pushups'
}

export function formatMovementLabel(movement: Movement) {
  return MOVEMENT_LABELS[movement]
}

export function formatMovementLabelLower(movement: Movement) {
  return MOVEMENT_LABELS[movement].toLowerCase()
}
