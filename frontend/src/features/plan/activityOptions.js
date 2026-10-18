import { WORKOUT_ACTIVITY_TYPES } from '../../../../shared/workoutPlan.js'

const ACTIVITY_LABELS = {
  rest: 'Rest',
  running: 'Running',
  cycling: 'Cycling',
  swimming: 'Swimming',
  strength_training: 'Strength training',
  climbing: 'Climbing',
  hiking: 'Hiking',
  walking: 'Walking',
  'stretching/yoga': 'Stretching / yoga',
}

export const ACTIVITY_OPTIONS = WORKOUT_ACTIVITY_TYPES.map((type) => [type, ACTIVITY_LABELS[type]])
