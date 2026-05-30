export type Movement = 'pullups' | 'pushups'

export type MovementRollConfig = {
  movement: Movement
  reps: readonly number[]
}

export const PULLUP_REPS = [3, 4, 5, 6, 7, 8] as const
export const PUSHUP_REPS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 30] as const
export const AVAILABLE_REPS = PUSHUP_REPS

export const MOVEMENT_ROLL_CONFIGS: readonly MovementRollConfig[] = [
  { movement: 'pullups', reps: PULLUP_REPS },
  { movement: 'pushups', reps: PUSHUP_REPS },
]

const MOVEMENT_LABELS: Record<Movement, string> = {
  pullups: 'Pullups',
  pushups: 'Pushups',
}

export function isMovement(value: unknown): value is Movement {
  return value === 'pullups' || value === 'pushups'
}

export function formatMovementLabel(movement: Movement) {
  return MOVEMENT_LABELS[movement]
}

export function formatMovementLabelLower(movement: Movement) {
  return MOVEMENT_LABELS[movement].toLowerCase()
}
