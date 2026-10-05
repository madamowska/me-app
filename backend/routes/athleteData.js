import { Router } from 'express'
import process from 'node:process'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'

const router = Router()
const WEEKDAYS = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateKeys(body, allowedKeys) {
  if (!isRecord(body)) return 'Request body must be a JSON object.'
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.includes(key))
  return unknownKeys.length ? `Unsupported field: ${unknownKeys[0]}.` : null
}

function validateText(value, field, maxLength, { nullable = false, required = false } = {}) {
  if (value === null && nullable) return null
  if (typeof value !== 'string') return `${field} must be ${nullable ? 'a string or null' : 'a string'}.`
  if (required && !value.trim()) return `${field} cannot be empty.`
  if (value.trim().length > maxLength) return `${field} must be at most ${maxLength} characters.`
  return null
}

function validateDate(value, field, { nullable = false } = {}) {
  if (value === null && nullable) return null
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return `${field} must be a date in YYYY-MM-DD format${nullable ? ' or null' : ''}.`
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return `${field} must be a valid calendar date.`
  }
  return null
}

function validateStringArray(value, field, { maxItems = 20, maxLength = 80 } = {}) {
  if (!Array.isArray(value)) return `${field} must be an array of strings.`
  if (value.length > maxItems) return `${field} cannot contain more than ${maxItems} items.`

  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > maxLength) {
      return `Each ${field} item must be a non-empty string of at most ${maxLength} characters.`
    }
  }
  return null
}

function validateRating(value, field, { nullable = true, min = 1, max = 5 } = {}) {
  if (value === null && nullable) return null
  if (!Number.isInteger(value) || value < min || value > max) {
    return `${field} must be an integer from ${min} to ${max}${nullable ? ' or null' : ''}.`
  }
  return null
}

function getAthleteProfileId() {
  const profileId = process.env.GARMIN_PROFILE_ID
  if (!profileId || !UUID_PATTERN.test(profileId)) {
    throw new Error('GARMIN_PROFILE_ID must be configured as an athlete profile UUID.')
  }
  return profileId
}

function sendValidationError(res, message) {
  return res.status(400).json({ error: message })
}

function handleDatabaseError(res, operation, error) {
  console.error(`${operation}:`, error)
  if (error.code === '23505') {
    return res.status(409).json({ error: 'That username is already in use.' })
  }
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code)) {
    return res.status(503).json({
      error: 'The Supabase schema is missing athlete profile tables or fields. Apply the pending migrations, then retry.',
    })
  }
  return res.status(500).json({ error: `${operation} failed.` })
}

const PROFILE_FIELDS = [
  'name',
  'date_of_birth',
  'height_cm',
  'weight_kg',
  'gender',
  'primary_activity',
  'goals',
  'activities',
  'available_days',
  'description',
]

function validateProfile(body) {
  const keyError = validateKeys(body, PROFILE_FIELDS)
  if (keyError) return keyError
  if (Object.keys(body).length === 0) return 'Provide at least one profile field to update.'

  const textFields = [
    ['name', 120],
    ['primary_activity', 40],
    ['goals', 2000],
    ['description', 4000],
  ]
  for (const [field, maxLength] of textFields) {
    if (field in body) {
      const error = validateText(body[field], field, maxLength, {
        nullable: field === 'name',
        required: false,
      })
      if (error) return error
    }
  }

  if ('gender' in body && body.gender !== null && !['female', 'male'].includes(body.gender)) {
    return 'gender must be female, male, or null.'
  }

  if ('primary_activity' in body && body.primary_activity !== null &&
      !['running', 'cycling', 'swimming', 'strength_training', 'climbing', 'hiking', 'walking', 'stretching/yoga']
        .includes(body.primary_activity)) {
    return 'primary_activity must be one of the supported activities or null.'
  }

  if ('date_of_birth' in body) {
    const error = validateDate(body.date_of_birth, 'date_of_birth', { nullable: true })
    if (error) return error
  }

  for (const [field, minimum, maximum] of [
    ['height_cm', 30, 300],
    ['weight_kg', 2, 700],
  ]) {
    if (field in body && body[field] !== null &&
        (typeof body[field] !== 'number' || !Number.isFinite(body[field]) ||
         body[field] < minimum || body[field] > maximum)) {
      return `${field} must be a number between ${minimum} and ${maximum}, or null.`
    }
  }

  if ('activities' in body) {
    const error = validateStringArray(body.activities, 'activities')
    if (error) return error
    const allowedActivities = new Set([
      'running',
      'cycling',
      'swimming',
      'strength_training',
      'climbing',
      'hiking',
      'walking',
      'stretching/yoga',
    ])
    if (body.activities.some((activity) => !allowedActivities.has(activity)) ||
        new Set(body.activities).size !== body.activities.length) {
      return 'activities must contain unique supported activity values.'
    }
  }

  if ('available_days' in body) {
    if (!Array.isArray(body.available_days) ||
        body.available_days.some((day) => typeof day !== 'string' || !WEEKDAYS.has(day)) ||
        new Set(body.available_days).size !== body.available_days.length) {
      return 'available_days must contain unique lowercase weekday names.'
    }
  }

  return null
}

const INJURY_FIELDS = ['injury_name', 'started_on', 'resolved_on', 'details']

function validateInjury(body, { requireName = false } = {}) {
  const keyError = validateKeys(body, INJURY_FIELDS)
  if (keyError) return keyError
  if (Object.keys(body).length === 0) return 'Provide at least one injury field.'
  if (requireName && !('injury_name' in body)) return 'injury_name is required.'

  if ('injury_name' in body) {
    const error = validateText(body.injury_name, 'injury_name', 150, { required: true })
    if (error) return error
  }
  for (const field of ['started_on', 'resolved_on']) {
    if (field in body) {
      const error = validateDate(body[field], field, { nullable: true })
      if (error) return error
    }
  }
  if ('details' in body) {
    const error = validateText(body.details, 'details', 3000, { nullable: true })
    if (error) return error
  }
  if (body.started_on && body.resolved_on && body.resolved_on < body.started_on) {
    return 'resolved_on cannot be earlier than started_on.'
  }
  return null
}

const FEEDBACK_FIELDS = ['soreness', 'sleep_hours', 'stress', 'notes']

function validateFeedback(body) {
  const keyError = validateKeys(body, FEEDBACK_FIELDS)
  if (keyError) return keyError
  if (Object.keys(body).length === 0) return 'Provide at least one feedback field.'

  for (const field of ['soreness', 'stress']) {
    if (field in body) {
      const error = validateRating(body[field], field)
      if (error) return error
    }
  }
  if ('sleep_hours' in body && body.sleep_hours !== null &&
      (typeof body.sleep_hours !== 'number' || !Number.isFinite(body.sleep_hours) ||
       body.sleep_hours < 0 || body.sleep_hours > 24)) {
    return 'sleep_hours must be a number from 0 to 24, or null.'
  }
  if ('notes' in body) {
    const error = validateText(body.notes, 'notes', 3000, { nullable: true })
    if (error) return error
  }
  return null
}

router.get('/athlete-profile', async (req, res) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('athlete_profiles')
      .select('*')
      .eq('id', getAthleteProfileId())
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not read athlete profile', error)
    if (!data) return res.status(404).json({ error: 'Athlete profile was not found.' })
    return res.json({ profile: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not read athlete profile', error)
  }
})

router.put('/athlete-profile', async (req, res) => {
  const validationError = validateProfile(req.body)
  if (validationError) return sendValidationError(res, validationError)

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('athlete_profiles')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', getAthleteProfileId())
      .select('*')
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not update athlete profile', error)
    if (!data) return res.status(404).json({ error: 'Athlete profile was not found.' })
    return res.json({ profile: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not update athlete profile', error)
  }
})

router.get('/injuries', async (req, res) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('injuries')
      .select('*')
      .eq('athlete_profile_id', getAthleteProfileId())
      .order('started_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) return handleDatabaseError(res, 'Could not read injuries', error)
    return res.json({ injuries: data || [] })
  } catch (error) {
    return handleDatabaseError(res, 'Could not read injuries', error)
  }
})

router.post('/injuries', async (req, res) => {
  const validationError = validateInjury(req.body, { requireName: true })
  if (validationError) return sendValidationError(res, validationError)

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('injuries')
      .insert({ ...req.body, athlete_profile_id: getAthleteProfileId() })
      .select('*')
      .single()
    if (error) return handleDatabaseError(res, 'Could not create injury', error)
    return res.status(201).json({ injury: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not create injury', error)
  }
})

router.put('/injuries/:injuryId', async (req, res) => {
  const validationError = validateInjury(req.body)
  if (validationError) return sendValidationError(res, validationError)
  if (!UUID_PATTERN.test(req.params.injuryId)) {
    return sendValidationError(res, 'injuryId must be a valid UUID.')
  }

  try {
    const supabase = getSupabaseAdmin()
    const profileId = getAthleteProfileId()
    const { data: existing, error: readError } = await supabase
      .from('injuries')
      .select('started_on, resolved_on')
      .eq('id', req.params.injuryId)
      .eq('athlete_profile_id', profileId)
      .maybeSingle()
    if (readError) return handleDatabaseError(res, 'Could not read injury', readError)
    if (!existing) return res.status(404).json({ error: 'Injury was not found.' })

    const mergedStarted = 'started_on' in req.body ? req.body.started_on : existing.started_on
    const mergedResolved = 'resolved_on' in req.body ? req.body.resolved_on : existing.resolved_on
    if (mergedStarted && mergedResolved && mergedResolved < mergedStarted) {
      return sendValidationError(res, 'resolved_on cannot be earlier than started_on.')
    }

    const { data, error } = await supabase
      .from('injuries')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.injuryId)
      .eq('athlete_profile_id', profileId)
      .select('*')
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not update injury', error)
    if (!data) return res.status(404).json({ error: 'Injury was not found.' })
    return res.json({ injury: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not update injury', error)
  }
})

router.delete('/injuries/:injuryId', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.injuryId)) {
    return sendValidationError(res, 'injuryId must be a valid UUID.')
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('injuries')
      .delete()
      .eq('id', req.params.injuryId)
      .eq('athlete_profile_id', getAthleteProfileId())
      .select('id')
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not delete injury', error)
    if (!data) return res.status(404).json({ error: 'Injury was not found.' })
    return res.status(204).end()
  } catch (error) {
    return handleDatabaseError(res, 'Could not delete injury', error)
  }
})

router.get('/feedback', async (req, res) => {
  const { from, to } = req.query
  if (from !== undefined) {
    const error = validateDate(from, 'from')
    if (error) return sendValidationError(res, error)
  }
  if (to !== undefined) {
    const error = validateDate(to, 'to')
    if (error) return sendValidationError(res, error)
  }
  if (from && to && from > to) {
    return sendValidationError(res, 'from cannot be later than to.')
  }
  if (from && to &&
      (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
        86400000 > 366) {
    return sendValidationError(res, 'Feedback date range cannot exceed 366 days.')
  }

  try {
    const profileId = getAthleteProfileId()
    const feedback = []
    const pageSize = 1000

    for (let offset = 0; ; offset += pageSize) {
      let query = getSupabaseAdmin()
        .from('feedback')
        .select('*')
        .eq('athlete_profile_id', profileId)
        .order('feedback_date', { ascending: false })

      if (from) query = query.gte('feedback_date', from)
      if (to) query = query.lte('feedback_date', to)

      const { data, error } = await query.range(offset, offset + pageSize - 1)
      if (error) return handleDatabaseError(res, 'Could not read feedback', error)

      feedback.push(...(data || []))
      if (!data || data.length < pageSize) break
    }

    return res.json({ feedback })
  } catch (error) {
    return handleDatabaseError(res, 'Could not read feedback', error)
  }
})

router.put('/feedback/:date', async (req, res) => {
  const dateError = validateDate(req.params.date, 'date')
  if (dateError) return sendValidationError(res, dateError)
  const validationError = validateFeedback(req.body)
  if (validationError) return sendValidationError(res, validationError)

  try {
    const supabase = getSupabaseAdmin()
    const profileId = getAthleteProfileId()
    const { data: existing, error: readError } = await supabase
      .from('feedback')
      .select('soreness, sleep_hours, stress, notes')
      .eq('athlete_profile_id', profileId)
      .eq('feedback_date', req.params.date)
      .maybeSingle()
    if (readError) return handleDatabaseError(res, 'Could not read feedback', readError)

    const { data, error } = await supabase
      .from('feedback')
      .upsert({
        athlete_profile_id: profileId,
        feedback_date: req.params.date,
        soreness: 'soreness' in req.body ? req.body.soreness : existing?.soreness ?? null,
        sleep_hours: 'sleep_hours' in req.body ? req.body.sleep_hours : existing?.sleep_hours ?? null,
        stress: 'stress' in req.body ? req.body.stress : existing?.stress ?? null,
        notes: 'notes' in req.body ? req.body.notes : existing?.notes ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'athlete_profile_id,feedback_date' })
      .select('*')
      .single()
    if (error) return handleDatabaseError(res, 'Could not save feedback', error)
    return res.json({ feedback: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not save feedback', error)
  }
})

router.delete('/feedback/:date', async (req, res) => {
  const dateError = validateDate(req.params.date, 'date')
  if (dateError) return sendValidationError(res, dateError)

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('feedback')
      .delete()
      .eq('athlete_profile_id', getAthleteProfileId())
      .eq('feedback_date', req.params.date)
      .select('feedback_date')
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not delete feedback', error)
    if (!data) return res.status(404).json({ error: 'Feedback was not found.' })
    return res.status(204).end()
  } catch (error) {
    return handleDatabaseError(res, 'Could not delete feedback', error)
  }
})

router.get('/account', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin()
    const { data: profile, error: profileError } = await supabase
      .from('athlete_profiles')
      .select('user_id')
      .eq('id', getAthleteProfileId())
      .maybeSingle()
    if (profileError) return handleDatabaseError(res, 'Could not read account', profileError)
    if (!profile?.user_id) {
      return res.status(404).json({ error: 'No Supabase Auth account is linked to this athlete profile.' })
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, username, created_at, updated_at')
      .eq('id', profile.user_id)
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not read account', error)
    if (!data) return res.status(404).json({ error: 'Account was not found.' })
    return res.json({ account: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not read account', error)
  }
})

router.put('/account', async (req, res) => {
  const keyError = validateKeys(req.body, ['username'])
  if (keyError) return sendValidationError(res, keyError)
  if (typeof req.body.username !== 'string' ||
      !/^[A-Za-z0-9_.-]{3,30}$/.test(req.body.username.trim())) {
    return sendValidationError(res, 'username must be 3–30 letters, numbers, dots, underscores, or hyphens.')
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data: profile, error: profileError } = await supabase
      .from('athlete_profiles')
      .select('user_id')
      .eq('id', getAthleteProfileId())
      .maybeSingle()
    if (profileError) return handleDatabaseError(res, 'Could not read account', profileError)
    if (!profile?.user_id) {
      return res.status(404).json({ error: 'No Supabase Auth account is linked to this athlete profile.' })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ username: req.body.username.trim(), updated_at: new Date().toISOString() })
      .eq('id', profile.user_id)
      .select('id, username, created_at, updated_at')
      .maybeSingle()
    if (error) return handleDatabaseError(res, 'Could not update account', error)
    if (!data) return res.status(404).json({ error: 'Account was not found.' })
    return res.json({ account: data })
  } catch (error) {
    return handleDatabaseError(res, 'Could not update account', error)
  }
})

export default router
