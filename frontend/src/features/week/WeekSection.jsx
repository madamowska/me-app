import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { sanitizeRichHtml } from '../../components/ui/richText'
import PopupShell from '../../components/popups/PopupShell'
import { getCurrentWorkoutPlan, updateWorkoutPlan } from '../plan/api'
import './WeekSection.css'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DISTANCE_ACTIVITIES = new Set(['running', 'cycling', 'biking', 'swimming', 'walking', 'hiking'])

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getDisplayedDays(plan) {
  const start = plan?.week_start || (() => {
    const monday = new Date()
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    return localDateKey(monday)
  })()

  return DAY_NAMES.map((name, index) => {
    const date = new Date(`${start}T00:00:00`)
    date.setDate(date.getDate() + index)
    const key = localDateKey(date)
    const workout = plan?.plan_data?.days?.find((entry) => entry.date === key) || null
    return {
      label: DAY_LABELS[index],
      date: date.getDate(),
      key,
      isToday: key === localDateKey(),
      workout,
    }
  })
}

function hasPlannedWorkout(workout) {
  if (!workout || workout.type === 'rest') return false
  return Boolean(
    workout.type?.trim()
    || workout.title?.trim()
    || workout.duration?.trim()
    || workout.pace?.trim()
    || workout.warmup?.length
    || workout.exercises?.length
    || workout.cooldown?.length
    || workout.notes?.trim()
    || workout.distanceKm != null
    || workout.speedKph != null
    || workout.elevationGainM != null
  )
}

function formatPlanRange(plan) {
  if (!plan?.week_start || !plan?.week_end) return ''
  const start = new Date(`${plan.week_start}T00:00:00Z`)
  const end = new Date(`${plan.week_end}T00:00:00Z`)
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })}`
}

function formatWorkoutText(value) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.join('\n')
  return ''
}

function formatDuration(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const legacy = value.match(/^(\d+)\s*(min|h)$/i)
  if (!legacy) return value
  const amount = Number(legacy[1])
  if (!Number.isSafeInteger(amount)) return value
  if (legacy[2].toLowerCase() === 'h') return `${amount}:00`
  return `${Math.floor(amount / 60)}:${String(amount % 60).padStart(2, '0')}`
}

function formatPace(value) {
  if (typeof value !== 'string') return ''
  const pace = value.trim()
  if (!pace) return ''
  const match = pace.match(/^(\d+):(\d{1,2})(?:\s*(?:min\/km|min\/100m))?$/i)
    || pace.match(/^(\d+)\s*(?:min\/km|min\/100m)$/i)
  if (!match || (match[2] !== undefined && Number(match[2]) > 59)) return value
  return `${Number(match[1])}:${(match[2] || '0').padStart(2, '0')}`
}

function getWeekCardSummary(workout) {
  const activity = workout.type?.toLowerCase().replaceAll('_', ' ').trim()
  const metric = DISTANCE_ACTIVITIES.has(activity)
    ? workout.distanceKm == null ? '' : `${Number(workout.distanceKm).toFixed(2)} km`
    : formatDuration(workout.duration)
  return [metric, workout.intensity].filter(Boolean).join(' · ')
}

function hasDisplayValue(value, rich = false) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string' || !value.trim()) return false
  if (!rich) return true
  const parsed = new DOMParser().parseFromString(sanitizeRichHtml(value), 'text/html')
  return Boolean(parsed.body.textContent?.trim())
}

function WorkoutDetails({ day, workout, onClose }) {
  const details = [
    ['Activity', workout.title, false],
    ['Type', workout.type?.replaceAll('_', ' '), false],
    ['Duration', formatDuration(workout.duration), false],
    ['Intensity', workout.intensity, false],
    ['Distance', workout.distanceKm == null ? '' : `${Number(workout.distanceKm).toFixed(2)} km`, false],
    ['Pace', formatPace(workout.pace), false],
    ['Speed', workout.speedKph == null ? '' : `${Number(workout.speedKph).toFixed(2)} km/h`, false],
    ['Elevation gain', workout.elevationGainM == null ? '' : `${workout.elevationGainM} m`, false],
    ['Warm-up', formatWorkoutText(workout.warmup), true],
    ['Workout details', formatWorkoutText(workout.exercises), true],
    ['Cool-down', formatWorkoutText(workout.cooldown), true],
    ['Additional notes', workout.notes, true],
  ].filter(([, value, rich]) => hasDisplayValue(value, rich))

  return (
    <PopupShell title={`${day.label} ${day.date} · workout details`} onClose={onClose}>
      {details.map(([label, value, rich]) => (
        <div className="detail-field" key={label}>
          <div className="detail-label">{label}</div>
          <div className="detail-value week-detail-value">
            {rich
              ? <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }} />
              : value}
          </div>
        </div>
      ))}
    </PopupShell>
  )
}

export default function WeekSection() {
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingDate, setSavingDate] = useState(null)
  const [activeDay, setActiveDay] = useState(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false
    getCurrentWorkoutPlan()
      .then((currentPlan) => {
        if (!cancelled) setPlan(currentPlan)
      })
      .catch((loadError) => {
        if (!cancelled && loadError.status !== 503) {
          setError(loadError.message || 'Could not load the current plan.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const days = getDisplayedDays(plan)

  async function toggleDone(day) {
    if (!plan || !day.workout || savingDate) return
    setSavingDate(day.key)
    setSaveError('')
    const planData = {
      ...plan.plan_data,
      days: plan.plan_data.days.map((entry) => (
        entry.date === day.key ? { ...entry, completed: !entry.completed } : entry
      )),
    }

    try {
      const updated = await updateWorkoutPlan(plan.id, { planData })
      setPlan(updated)
    } catch (updateError) {
      setSaveError(updateError.message || 'Could not update workout completion.')
    } finally {
      setSavingDate(null)
    }
  }

  return (
    <section className="week-section" aria-labelledby="week-section-title">
      <div className="week-section-header">
        <div>
          <h2 id="week-section-title">Week</h2>
          {plan && <p>{plan.title} · {formatPlanRange(plan)}</p>}
        </div>
        <Button variant="accent" onClick={() => navigate('/plan')}>
          {plan ? 'Manage plan' : 'Choose a plan'}
        </Button>
      </div>

      {loading && <p className="week-status" role="status">Loading current plan…</p>}
      {error && <p className="week-status week-status--error" role="alert">{error}</p>}
      {saveError && <p className="week-status week-status--error" role="alert">{saveError}</p>}
      {!loading && !error && !plan && (
        <p className="week-status">No workout plans available. Select a workout plan to display.</p>
      )}

      {!loading && !error && (
        <div className="week-days">
          {days.map((day) => {
            const workout = day.workout
            const hasWorkout = hasPlannedWorkout(workout)
            const summary = workout ? getWeekCardSummary(workout) : ''
            const workoutTitle = workout?.title?.trim()
              || workout?.type?.replaceAll('_', ' ')
              || 'Workout'
            return (
              <article
                key={day.key}
                className={`week-day${day.isToday ? ' week-day--today' : ''}${workout?.completed ? ' week-day--done' : ''}`}
              >
                <div className="week-day-heading">
                  <span className="week-day-name">{day.label}</span>
                  <span className="week-day-date">{day.date}</span>
                </div>

                {hasWorkout && workout ? (
                  <button
                    type="button"
                    className={`week-workout-name${workout.completed ? ' week-workout-name--done' : ''}`}
                    onClick={() => setActiveDay({ ...day, workout })}
                  >
                    <span>{workoutTitle}</span>
                    {summary && <small>{summary}</small>}
                  </button>
                ) : (
                  <p className="week-day-empty">
                    {workout?.type === 'rest' ? workout.title?.trim() || 'Rest day' : 'No workout planned'}
                  </p>
                )}
                <div className="week-day-footer">
                  {hasWorkout && workout && (
                    <label className="week-done-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(workout.completed)}
                        disabled={savingDate !== null}
                        onChange={() => toggleDone(day)}
                        aria-label={`Mark ${workoutTitle} as ${workout.completed ? 'not done' : 'done'}`}
                      />
                      <span>Done</span>
                    </label>
                  )}
                  {savingDate === day.key && <span className="week-saving-label">Saving…</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {activeDay && (
        <WorkoutDetails
          day={activeDay}
          workout={activeDay.workout}
          onClose={() => setActiveDay(null)}
        />
      )}
    </section>
  )
}
