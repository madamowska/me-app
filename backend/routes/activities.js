// backend/routes/activities.js
import { Router } from 'express'
import { spawn } from 'child_process'
import process from 'node:process'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'

const router = Router()

let syncInProgress = false

router.get('/last-activity', async (req, res) => {
  const profileId = process.env.GARMIN_PROFILE_ID
  if (!profileId) {
    return res.status(500).json({ error: 'GARMIN_PROFILE_ID not configured on server.' })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('activities')
      .select(
        'activity_name, activity_type, start_time, duration_seconds, distance_m, ' +
        'avg_speed_mps, calories, avg_heart_rate, max_heart_rate'
      )
      .eq('athlete_profile_id', profileId)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    res.json({ activity: data || null })
  } catch (err) {
    console.error('Failed to fetch last activity:', err)
    res.status(500).json({ error: 'Failed to fetch last activity.' })
  }
})

router.get('/last-activities', async (req, res) => {
  const profileId = process.env.GARMIN_PROFILE_ID
  if (!profileId) {
    return res.status(500).json({ error: 'GARMIN_PROFILE_ID not configured on server.' })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('activities')
      .select(
        'activity_name, activity_type, start_time, duration_seconds, distance_m, ' +
        'avg_speed_mps, calories, avg_heart_rate, max_heart_rate'
      )
      .eq('athlete_profile_id', profileId)
      .order('start_time', { ascending: false })
      .limit(3)

    if (error) throw error

    res.json({ activities: data || [] })
  } catch (err) {
    console.error('Failed to fetch last activities:', err)
    res.status(500).json({ error: 'Failed to fetch last activities.' })
  }
})

router.get('/weekly-distance', async (req, res) => {
  const profileId = process.env.GARMIN_PROFILE_ID
  if (!profileId) {
    return res.status(500).json({ error: 'GARMIN_PROFILE_ID not configured on server.' })
  }

  const sport = typeof req.query.sport === 'string' ? req.query.sport : 'running'
  const supportedSports = ['running', 'cycling', 'walking']
  if (!supportedSports.includes(sport)) {
    return res.status(400).json({ error: 'sport must be running, cycling, or walking.' })
  }

  const weeksValue = req.query.weeks === undefined ? '10' : req.query.weeks
  const weeks = typeof weeksValue === 'string' ? Number(weeksValue) : Number.NaN
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
    return res.status(400).json({ error: 'weeks must be an integer from 1 to 52.' })
  }

  const currentWeekStart = new Date()
  currentWeekStart.setUTCHours(0, 0, 0, 0)
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - ((currentWeekStart.getUTCDay() + 6) % 7))
  const firstWeekStart = new Date(currentWeekStart)
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - (weeks - 1) * 7)
  const end = new Date(currentWeekStart)
  end.setUTCDate(end.getUTCDate() + 7)

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('activities')
      .select('start_time, distance_m')
      .eq('athlete_profile_id', profileId)
      .ilike('activity_type', `%${sport}%`)
      .gte('start_time', firstWeekStart.toISOString())
      .lt('start_time', end.toISOString())

    if (error) throw error

    const totals = new Map()
    for (let index = 0; index < weeks; index += 1) {
      const weekStart = new Date(firstWeekStart)
      weekStart.setUTCDate(weekStart.getUTCDate() + index * 7)
      totals.set(weekStart.toISOString().slice(0, 10), 0)
    }

    for (const activity of data || []) {
      const startTime = new Date(activity.start_time)
      startTime.setUTCHours(0, 0, 0, 0)
      startTime.setUTCDate(startTime.getUTCDate() - ((startTime.getUTCDay() + 6) % 7))
      const weekStart = startTime.toISOString().slice(0, 10)
      const distance = Number(activity.distance_m) || 0
      totals.set(weekStart, (totals.get(weekStart) || 0) + distance / 1000)
    }

    res.json({
      weeks: [...totals].map(([week_start, distance_km]) => ({ week_start, distance_km })),
    })
  } catch (err) {
    console.error('Failed to fetch weekly distance:', err)
    res.status(500).json({ error: 'Failed to fetch weekly distance.' })
  }
})

router.post('/sync-activities', (req, res) => {
  if (syncInProgress) {
    return res.status(409).json({ success: false, error: 'A sync is already in progress.' })
  }

  syncInProgress = true

  const python = spawn('python', ['-m', 'backend.garmin.sync_activities'], {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })

  let stdout = ''
  let stderr = ''

  python.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  python.stderr.on('data', (chunk) => { stderr += chunk.toString() })

  python.on('close', (code) => {
    syncInProgress = false

    if (code !== 0) {
      console.error('Sync script failed:', stderr)
      return res.status(500).json({
        success: false,
        error: stderr.trim() || 'Sync script exited with an error.',
      })
    }

    const resultLine = stdout
      .split('\n')
      .find((line) => line.startsWith('SYNC_RESULT_JSON:'))

    if (!resultLine) {
      console.error('Sync script did not emit a result line:', stdout)
      return res.status(500).json({ success: false, error: 'Sync completed but result was unreadable.' })
    }

    try {
      const result = JSON.parse(resultLine.replace('SYNC_RESULT_JSON:', ''))
      res.json(result)
    } catch (err) {
      console.error('Failed to parse sync result:', err, resultLine)
      res.status(500).json({ success: false, error: 'Sync completed but result was unreadable.' })
    }
  })

  python.on('error', (err) => {
    syncInProgress = false
    console.error('Failed to start sync script:', err)
    res.status(500).json({ success: false, error: 'Could not start sync process.' })
  })
})

export default router