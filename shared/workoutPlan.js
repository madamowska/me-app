export const WORKOUT_ACTIVITY_TYPES = [
  'rest',
  'running',
  'cycling',
  'swimming',
  'strength_training',
  'climbing',
  'hiking',
  'walking',
  'stretching/yoga',
]

export const WORKOUT_DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const DAY_FIELDS = new Set([
  'day',
  'date',
  'type',
  'title',
  'durationMinutes',
  'duration',
  'intensity',
  'warmup',
  'exercises',
  'cooldown',
  'notes',
  'distanceKm',
  'pace',
  'speedKph',
  'elevationGainM',
  'completed',
])

const PLAN_FIELDS = new Set([
  'summary',
  'days',
  'recoveryNotes',
  'weekStart',
  'weekEnd',
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeActivityType(value) {
  if (typeof value !== 'string') throw new Error('Workout type must be a string.')
  const aliases = {
    biking: 'cycling',
    'strength training': 'strength_training',
  }
  const type = aliases[value.trim().toLowerCase()] || value.trim().toLowerCase()
  if (!WORKOUT_ACTIVITY_TYPES.includes(type)) {
    throw new Error(`Unsupported workout type "${value}".`)
  }
  return type
}

function normalizeIntensity(value) {
  if (value == null || value === '') return 'easy'
  if (value !== 'easy' && value !== 'moderate' && value !== 'hard') {
    throw new Error('Workout intensity must be exactly easy, moderate, or hard.')
  }
  return value
}

function durationFromLegacy(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const duration = value.trim()
  let match = duration.match(/^(\d+)\s*min$/i)
  if (match) return Number(match[1])
  match = duration.match(/^(\d+)\s*h$/i)
  if (match) return Number(match[1]) * 60
  match = duration.match(/^(\d+):([0-5]\d)$/)
  if (match) return Number(match[1]) * 60 + Number(match[2])
  throw new Error('Workout duration must be a non-negative number of minutes.')
}

function normalizeDurationMinutes(day) {
  const value = day.durationMinutes ?? durationFromLegacy(day.duration)
  if (value === null) return null
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Workout durationMinutes must be a non-negative integer or null.')
  }
  return value
}

function normalizeStringArray(value, field) {
  if (value === undefined || value === null) return []
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : null
  if (!entries || entries.length > 40 ||
      entries.some((item) => typeof item !== 'string' || item.length > 4000)) {
    throw new Error(`${field} must be an array of at most 40 strings, each at most 4000 characters.`)
  }
  return entries.map((item) => item.trim()).filter(Boolean)
}

function normalizeMetric(value, field) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number or null.`)
  }
  return value
}

export function normalizeWorkoutDay(
  day,
  { includeCompleted = false, stripUnsupportedFields = false } = {},
) {
  if (!isRecord(day)) throw new Error('Each workout day must be an object.')
  const input = stripUnsupportedFields
    ? Object.fromEntries(Object.entries(day).filter(([field]) => DAY_FIELDS.has(field)))
    : day
  if (Object.keys(input).some((field) => !DAY_FIELDS.has(field))) {
    throw new Error('Workout day contains an unsupported field.')
  }

  const type = normalizeActivityType(input.type)
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const intensity = type === 'rest' ? 'easy' : normalizeIntensity(input.intensity)
  const notes = input.notes ?? ''
  const pace = input.pace ?? ''

  if (typeof notes !== 'string' || typeof pace !== 'string') {
    throw new Error('Workout notes and pace must be strings.')
  }

  const normalized = {
    day: input.day,
    date: input.date,
    type,
    title,
    durationMinutes: normalizeDurationMinutes(input),
    intensity,
    warmup: normalizeStringArray(input.warmup, 'warmup'),
    exercises: normalizeStringArray(input.exercises, 'exercises'),
    cooldown: normalizeStringArray(input.cooldown, 'cooldown'),
    notes,
    distanceKm: normalizeMetric(input.distanceKm, 'distanceKm'),
    pace: pace.trim(),
    speedKph: normalizeMetric(input.speedKph, 'speedKph'),
    elevationGainM: normalizeMetric(input.elevationGainM, 'elevationGainM'),
  }

  if (typeof normalized.day !== 'string' || typeof normalized.date !== 'string') {
    throw new Error('Workout day and date are required strings.')
  }
  if (includeCompleted && input.completed !== undefined) {
    if (typeof input.completed !== 'boolean') throw new Error('completed must be a boolean.')
    normalized.completed = input.completed
  }

  return normalized
}

export function normalizeWorkoutPlan(plan, { stripUnsupportedFields = false } = {}) {
  if (!isRecord(plan)) throw new Error('Workout plan must be an object.')
  const input = stripUnsupportedFields
    ? Object.fromEntries(Object.entries(plan).filter(([field]) => PLAN_FIELDS.has(field)))
    : plan
  if (Object.keys(input).some((field) => !PLAN_FIELDS.has(field))) {
    throw new Error('Workout plan contains an unsupported field.')
  }
  if (!Array.isArray(input.days) || input.days.length !== 7) {
    throw new Error('Workout plan must contain exactly seven days.')
  }
  if (input.summary != null && typeof input.summary !== 'string') {
    throw new Error('Workout plan summary must be a string.')
  }
  if (input.recoveryNotes != null && !Array.isArray(input.recoveryNotes)) {
    throw new Error('Workout plan recoveryNotes must be an array of strings.')
  }
  const recoveryNotes = normalizeStringArray(input.recoveryNotes, 'recoveryNotes')

  return {
    summary: (input.summary ?? '').trim(),
    days: input.days.map((day) => normalizeWorkoutDay(day, { stripUnsupportedFields })),
    recoveryNotes,
  }
}

export function validateWorkoutPlan(plan, weekStart) {
  let normalized
  try {
    normalized = normalizeWorkoutPlan(plan)
  } catch (error) {
    return error.message
  }

  if (normalized.summary.length > 4000) return 'summary must be at most 4000 characters.'
  if (normalized.recoveryNotes.some((note) => note.length > 500)) {
    return 'recoveryNotes entries must be at most 500 characters.'
  }

  const parsedWeekStart = new Date(`${weekStart}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
      Number.isNaN(parsedWeekStart.getTime()) ||
      parsedWeekStart.toISOString().slice(0, 10) !== weekStart ||
      parsedWeekStart.getUTCDay() !== 1) {
    return 'weekStart must be a valid Monday in YYYY-MM-DD format.'
  }

  const expectedDate = parsedWeekStart
  for (const [index, day] of normalized.days.entries()) {
    const date = expectedDate.toISOString().slice(0, 10)
    if (day.day !== WORKOUT_DAY_NAMES[index] || day.date !== date) {
      return 'Plan days must run Monday to Sunday and match the selected week.'
    }
    if (day.title.length > 160) return `Day ${index + 1} title must be at most 160 characters.`
    if (day.notes.length > 24000 || day.pace.length > 80) return `Day ${index + 1} notes or pace are too long.`
    if (day.type === 'rest' &&
        ((day.durationMinutes !== null && day.durationMinutes !== 0)
          || day.warmup.length || day.exercises.length || day.cooldown.length)) {
      return `Day ${index + 1} rest days must have null or zero duration and no workout steps.`
    }
    expectedDate.setUTCDate(expectedDate.getUTCDate() + 1)
  }
  return null
}
