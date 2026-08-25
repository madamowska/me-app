// backend/routes/activities.js
import { Router } from 'express'
import { spawn } from 'child_process'
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
      .select('activity_name, activity_type, start_time, duration_seconds')
      .eq('profile_id', profileId)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return res.json({ message: 'No activities found yet.' })
    }

    const durationLabel = data.duration_seconds
      ? `${Math.round(data.duration_seconds / 60)} min`
      : '--'
    const dateLabel = data.start_time
      ? new Date(data.start_time).toLocaleDateString()
      : ''

    res.json({
      type: data.activity_type,
      duration: durationLabel,
      date: dateLabel,
      message: `${data.activity_name || data.activity_type || 'Activity'} • ${durationLabel} • ${dateLabel}`,
    })
  } catch (err) {
    console.error('Failed to fetch last activity:', err)
    res.status(500).json({ error: 'Failed to fetch last activity.' })
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