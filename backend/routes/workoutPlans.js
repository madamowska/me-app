import { Router } from 'express'
import process from 'node:process'
import { generateWorkoutPlan } from '../services/workoutPlanService.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { createWorkoutPlanDocx } from '../lib/workoutPlanDocument.js'

const router = Router()
export const workoutPlanExportRouter = Router()
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_FIELDS = new Set([
  'day',
  'date',
  'type',
  'title',
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

function getAthleteProfileId() {
  const profileId = process.env.GARMIN_PROFILE_ID
  if (!profileId || !UUID_PATTERN.test(profileId)) {
    throw new Error('GARMIN_PROFILE_ID must be configured as an athlete profile UUID.')
  }
  return profileId
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function weekEndFor(start) {
  const end = new Date(`${start}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  return end.toISOString().slice(0, 10)
}

function validateWeekStart(value) {
  if (!validDate(value)) return 'weekStart must be a valid date in YYYY-MM-DD format.'
  if (new Date(`${value}T00:00:00.000Z`).getUTCDay() !== 1) {
    return 'weekStart must be a Monday.'
  }
  return null
}

function validateString(value, field, maxLength, { required = false } = {}) {
  if (typeof value !== 'string') return `${field} must be a string.`
  if (required && !value.trim()) return `${field} cannot be empty.`
  if (value.length > maxLength) return `${field} must be at most ${maxLength} characters.`
  return null
}

function validateStringArray(value, field) {
  if (!Array.isArray(value) || value.length > 40 ||
      value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 500)) {
    return `${field} must be an array of at most 40 non-empty strings, each at most 500 characters.`
  }
  return null
}

function validatePlanData(planData, weekStart) {
  if (!isRecord(planData)) return 'planData must be a JSON object.'
  if (Object.keys(planData).some((key) => !['summary', 'days', 'recoveryNotes'].includes(key))) {
    return 'planData contains an unsupported field.'
  }
  if (typeof planData.summary !== 'string' || planData.summary.length > 4000) {
    return 'planData.summary must be a string of at most 4000 characters.'
  }
  const recoveryError = validateStringArray(planData.recoveryNotes, 'planData.recoveryNotes')
  if (recoveryError) return recoveryError
  if (!Array.isArray(planData.days) || planData.days.length !== 7) {
    return 'planData.days must contain exactly seven days.'
  }

  const expectedDate = new Date(`${weekStart}T00:00:00.000Z`)
  for (const [index, day] of planData.days.entries()) {
    if (!isRecord(day)) return `Day ${index + 1} must be a JSON object.`
    if (Object.keys(day).some((key) => !DAY_FIELDS.has(key))) {
      return `Day ${index + 1} contains an unsupported field.`
    }
    const date = expectedDate.toISOString().slice(0, 10)
    if (day.day !== DAY_NAMES[index] || day.date !== date) {
      return 'Plan days must run Monday to Sunday and match the selected week.'
    }
    for (const [field, limit] of [['type', 60], ['title', 160], ['duration', 30], ['intensity', 20], ['notes', 24000]]) {
      const error = validateString(day[field], `Day ${index + 1} ${field}`, limit)
      if (error) return error
    }
    if (day.duration !== '' && !/^(?:\d+( min| h)|\d+:\d{2})$/.test(day.duration)) {
      return `Day ${index + 1} duration must use H:MM or a legacy minute/hour format.`
    }
    if (/^\d+:\d{2}$/.test(day.duration) && Number(day.duration.split(':')[1]) > 59) {
      return `Day ${index + 1} duration minutes must be between 00 and 59.`
    }
    if (day.intensity !== '' && !['easy', 'moderate', 'hard'].includes(day.intensity)) {
      return `Day ${index + 1} intensity must be easy, moderate, or hard.`
    }
    for (const field of ['warmup', 'exercises', 'cooldown']) {
      if (typeof day[field] === 'string') {
        if (day[field].length > 40000) {
          return `Day ${index + 1} ${field} must be at most 40000 characters.`
        }
      } else {
        const error = validateStringArray(day[field], `Day ${index + 1} ${field}`)
        if (error) return error
      }
    }
    if ('distanceKm' in day && day.distanceKm !== null &&
        (typeof day.distanceKm !== 'number' || !Number.isFinite(day.distanceKm) || day.distanceKm < 0)) {
      return `Day ${index + 1} distanceKm must be a non-negative number or null.`
    }
    if ('pace' in day && (typeof day.pace !== 'string' || day.pace.length > 80)) {
      return `Day ${index + 1} pace must be a string of at most 80 characters.`
    }
    for (const field of ['speedKph', 'elevationGainM']) {
      if (field in day && day[field] !== null &&
          (typeof day[field] !== 'number' || !Number.isFinite(day[field]) || day[field] < 0)) {
        return `Day ${index + 1} ${field} must be a non-negative number or null.`
      }
    }
    if ('completed' in day && typeof day.completed !== 'boolean') {
      return `Day ${index + 1} completed must be a boolean.`
    }
    expectedDate.setUTCDate(expectedDate.getUTCDate() + 1)
  }
  return null
}

workoutPlanExportRouter.post('/workout-plan/generate', async (req, res) => {
  const preferences = req.body?.preferences ?? {}

  if (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences)) {
    return res.status(400).json({ error: 'preferences must be a JSON object.' })
  }

  try {
    const plan = await generateWorkoutPlan({ preferences })
    const document = await createWorkoutPlanDocx(plan)
    const filename = `workout-plan-${plan.weekStart}.docx`

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(document)
  } catch (error) {
    console.error('Failed to generate workout plan:', error)
    return res
      .status(error.statusCode || 500)
      .json({ error: error.publicMessage || 'Failed to generate workout plan.' })
  }
})

function handleDatabaseError(res, operation, error) {
  console.error(`${operation}:`, error)
  if (['42P01', '42703', '42883', 'PGRST204', 'PGRST205'].includes(error.code)) {
    if (operation.toLowerCase().includes('workout activit')) {
      return res.status(503).json({
        error: 'Workout activity storage is unavailable. Apply the 20261015101100_create_workout_plan_activities.sql migration and try again.',
      })
    }
    return res.status(503).json({
      error: 'No workout plans available. Select a workout plan to display.',
    })
  }
  return res.status(500).json({ error: `${operation} failed.` })
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('workout_plans')
      .select('id, title, week_start, week_end, plan_data, is_current, created_at, updated_at')
      .eq('athlete_profile_id', getAthleteProfileId())
      .order('created_at', { ascending: false })
    if (error) return handleDatabaseError(res, 'Could not load workout plans', error)
    return res.json({ plans: data || [] })
  } catch (error) {
    return handleDatabaseError(res, 'Could not load workout plans', error)
  }
})

router.get('/current', async (req, res) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('workout_plans')
      .select('id, title, week_start, week_end, plan_data, is_current, created_at, updated_at')
      .eq('athlete_profile_id', getAthleteProfileId())
      .eq('is_current', true)
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not load the current workout plan', error)
    return res.json({ plan: data || null })
  } catch (error) {
    return handleDatabaseError(res, 'Could not load the current workout plan', error)
  }
})

router.get('/:planId/activities', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.planId)) {
    return res.status(400).json({ error: 'planId must be a valid UUID.' })
  }

  try {
    const supabase = getSupabaseAdmin()
    const profileId = getAthleteProfileId()
    const { data: plan, error: planError } = await supabase
      .from('workout_plans')
      .select('id')
      .eq('id', req.params.planId)
      .eq('athlete_profile_id', profileId)
      .maybeSingle()
    if (planError) return handleDatabaseError(res, 'Could not read workout plan', planError)
    if (!plan) return res.status(404).json({ error: 'Workout plan was not found.' })

    const { data, error } = await supabase
      .from('workout_plan_activities')
      .select('workout_date, workout_data, is_completed, completed_at')
      .eq('plan_id', plan.id)
      .eq('athlete_profile_id', profileId)
      .order('workout_date', { ascending: true })
    if (error) return handleDatabaseError(res, 'Could not load workout activities', error)
    return res.json({ activities: data || [] })
  } catch (error) {
    return handleDatabaseError(res, 'Could not load workout activities', error)
  }
})

router.put('/:planId/activities/:date', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.planId)) {
    return res.status(400).json({ error: 'planId must be a valid UUID.' })
  }
  if (!validDate(req.params.date)) {
    return res.status(400).json({ error: 'date must be a valid date in YYYY-MM-DD format.' })
  }
  if (!isRecord(req.body) ||
      Object.keys(req.body).some((key) => key !== 'activities') ||
      !Array.isArray(req.body.activities) ||
      req.body.activities.length > 20 ||
      req.body.activities.some((activity) => !isRecord(activity))) {
    return res.status(400).json({ error: 'activities must be an array of at most 20 workout objects.' })
  }

  try {
    const supabase = getSupabaseAdmin()
    const profileId = getAthleteProfileId()
    const { data: plan, error: planError } = await supabase
      .from('workout_plans')
      .select('id, week_start, plan_data')
      .eq('id', req.params.planId)
      .eq('athlete_profile_id', profileId)
      .maybeSingle()
    if (planError) return handleDatabaseError(res, 'Could not read workout plan', planError)
    if (!plan) return res.status(404).json({ error: 'Workout plan was not found.' })

    const planDays = plan.plan_data?.days
    const original = Array.isArray(planDays)
      ? planDays.find((day) => day.date === req.params.date)
      : null
    if (!original) return res.status(400).json({ error: 'The date is not part of this workout plan.' })

    const activities = req.body.activities.map((activity) => ({
      ...activity,
      day: original.day,
      date: req.params.date,
    }))
    for (const [index, activity] of activities.entries()) {
      const planData = {
        ...plan.plan_data,
        days: planDays.map((day) => (
          day.date === req.params.date ? activity : day
        )),
      }
      const planErrorMessage = validatePlanData(planData, plan.week_start)
      if (planErrorMessage) {
        return res.status(400).json({ error: `Activity ${index + 1}: ${planErrorMessage}` })
      }
    }

    const { data, error } = await supabase
      .from('workout_plan_activities')
      .upsert({
        plan_id: plan.id,
        athlete_profile_id: profileId,
        workout_date: req.params.date,
        workout_data: { activities },
        is_completed: activities.length > 0 && activities.every((activity) => activity.completed === true),
        completed_at: activities.length > 0 && activities.every((activity) => activity.completed === true)
          ? new Date().toISOString()
          : null,
      }, { onConflict: 'plan_id,workout_date' })
      .select('workout_date, workout_data, is_completed, completed_at')
      .single()
    if (error) return handleDatabaseError(res, 'Could not save workout activity', error)
    return res.json({ activity: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not save workout activity', error)
  }
})

router.post('/generate', async (req, res) => {
  const { weekStart, preferences = {} } = req.body || {}
  const dateError = validateWeekStart(weekStart)
  if (dateError) return res.status(400).json({ error: dateError })
  if (!isRecord(preferences)) {
    return res.status(400).json({ error: 'preferences must be a JSON object.' })
  }

  try {
    const plan = await generateWorkoutPlan({
      profileId: getAthleteProfileId(),
      preferences,
      weekStart,
    })
    const planData = {
      summary: plan.summary,
      days: plan.days,
      recoveryNotes: plan.recoveryNotes,
    }
    const planError = validatePlanData(planData, weekStart)
    if (planError) {
      return res.status(502).json({ error: `LM Studio returned an invalid workout plan: ${planError}` })
    }
    return res.json({ plan })
  } catch (error) {
    console.error('Failed to generate workout plan:', error)
    return res.status(error.statusCode || 500).json({
      error: error.publicMessage || 'Failed to generate workout plan.',
    })
  }
})

router.post('/', async (req, res) => {
  const { title, weekStart, planData } = req.body || {}
  const titleError = validateString(title, 'title', 120, { required: true })
  if (titleError) return res.status(400).json({ error: titleError })
  const dateError = validateWeekStart(weekStart)
  if (dateError) return res.status(400).json({ error: dateError })
  const planError = validatePlanData(planData, weekStart)
  if (planError) return res.status(400).json({ error: planError })

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('workout_plans')
      .insert({
        athlete_profile_id: getAthleteProfileId(),
        title: title.trim(),
        week_start: weekStart,
        week_end: weekEndFor(weekStart),
        plan_data: planData,
      })
      .select('id, title, week_start, week_end, plan_data, is_current, created_at, updated_at')
      .single()
    if (error) return handleDatabaseError(res, 'Could not save workout plan', error)
    return res.status(201).json({ plan: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not save workout plan', error)
  }
})

router.put('/:planId/current', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.planId)) {
    return res.status(400).json({ error: 'planId must be a valid UUID.' })
  }

  try {
    const supabase = getSupabaseAdmin()
    const profileId = getAthleteProfileId()
    const { data: selectedPlan, error: readError } = await supabase
      .from('workout_plans')
      .select('id')
      .eq('id', req.params.planId)
      .eq('athlete_profile_id', profileId)
      .maybeSingle()
    if (readError) return handleDatabaseError(res, 'Could not select workout plan', readError)
    if (!selectedPlan) return res.status(404).json({ error: 'Workout plan was not found.' })

    const { error } = await supabase.rpc('set_current_workout_plan', {
      target_plan_id: selectedPlan.id,
      target_athlete_profile_id: profileId,
    })
    if (error) return handleDatabaseError(res, 'Could not set current workout plan', error)

    const { data, error: fetchError } = await supabase
      .from('workout_plans')
      .select('id, title, week_start, week_end, plan_data, is_current, created_at, updated_at')
      .eq('id', selectedPlan.id)
      .single()
    if (fetchError) return handleDatabaseError(res, 'Could not reload current workout plan', fetchError)
    return res.json({ plan: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not set current workout plan', error)
  }
})

router.patch('/:planId', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.planId)) {
    return res.status(400).json({ error: 'planId must be a valid UUID.' })
  }
  if (!isRecord(req.body) || Object.keys(req.body).some((key) => !['title', 'weekStart', 'planData'].includes(key)) ||
      Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Provide title, weekStart, and/or planData to update.' })
  }

  const updates = {}
  if ('title' in req.body) {
    const titleError = validateString(req.body.title, 'title', 120, { required: true })
    if (titleError) return res.status(400).json({ error: titleError })
    updates.title = req.body.title.trim()
  }

  try {
    let existingWeekStart
    if ('planData' in req.body || 'weekStart' in req.body) {
      const { data: existing, error: readError } = await getSupabaseAdmin()
        .from('workout_plans')
        .select('week_start')
        .eq('id', req.params.planId)
        .eq('athlete_profile_id', getAthleteProfileId())
        .maybeSingle()
      if (readError) return handleDatabaseError(res, 'Could not read workout plan', readError)
      if (!existing) return res.status(404).json({ error: 'Workout plan was not found.' })
      existingWeekStart = existing.week_start
    }

    if ('weekStart' in req.body) {
      const dateError = validateWeekStart(req.body.weekStart)
      if (dateError) return res.status(400).json({ error: dateError })
      if (!('planData' in req.body) && req.body.weekStart !== existingWeekStart) {
        return res.status(400).json({ error: 'planData is required when changing weekStart.' })
      }
      updates.week_start = req.body.weekStart
      updates.week_end = weekEndFor(req.body.weekStart)
    }

    if ('planData' in req.body) {
      const targetWeekStart = req.body.weekStart || existingWeekStart
      const planError = validatePlanData(req.body.planData, targetWeekStart)
      if (planError) return res.status(400).json({ error: planError })
      updates.plan_data = req.body.planData
    }

    const { data, error } = await getSupabaseAdmin()
      .from('workout_plans')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.params.planId)
      .eq('athlete_profile_id', getAthleteProfileId())
      .select('id, title, week_start, week_end, plan_data, is_current, created_at, updated_at')
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not update workout plan', error)
    if (!data) return res.status(404).json({ error: 'Workout plan was not found.' })
    return res.json({ plan: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not update workout plan', error)
  }
})

router.delete('/:planId', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.planId)) {
    return res.status(400).json({ error: 'planId must be a valid UUID.' })
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('workout_plans')
      .delete()
      .eq('id', req.params.planId)
      .eq('athlete_profile_id', getAthleteProfileId())
      .select('id')
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not delete workout plan', error)
    if (!data) return res.status(404).json({ error: 'Workout plan was not found.' })
    return res.status(204).end()
  } catch (error) {
    return handleDatabaseError(res, 'Could not delete workout plan', error)
  }
})

export default router
