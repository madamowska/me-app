import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { sanitizeRichHtml } from '../../components/ui/richText'
import PopupShell from '../../components/popups/PopupShell'
import {
  getCurrentWorkoutPlan,
  getWorkoutActivities,
  saveWorkoutActivity,
} from '../plan/api'
import { ACTIVITY_OPTIONS } from '../plan/activityOptions'
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

function createEmptyActivity(day) {
  return {
    day: DAY_NAMES[DAY_LABELS.indexOf(day.label)],
    date: day.key,
    type: '',
    title: '',
    duration: '',
    intensity: '',
    warmup: [],
    exercises: [],
    cooldown: [],
    notes: '',
    distanceKm: null,
    pace: '',
    speedKph: null,
    elevationGainM: null,
    completed: false,
  }
}

function getDayActivities(day, savedActivity) {
  const saved = savedActivity?.workout_data
  if (Array.isArray(saved?.activities)) return saved.activities
  if (saved && typeof saved === 'object') {
    return [{ ...saved, completed: Boolean(savedActivity.is_completed) }]
  }
  return hasPlannedWorkout(day.workout)
    ? [{ ...day.workout, completed: Boolean(day.workout.completed) }]
    : []
}

function toEditValues(workout) {
  return {
    title: workout.title || '',
    type: workout.type || '',
    duration: formatDuration(workout.duration),
    intensity: workout.intensity || '',
    distanceKm: workout.distanceKm == null ? '' : String(workout.distanceKm),
    pace: workout.pace || '',
    speedKph: workout.speedKph == null ? '' : String(workout.speedKph),
    elevationGainM: workout.elevationGainM == null ? '' : String(workout.elevationGainM),
    warmup: formatWorkoutText(workout.warmup),
    exercises: formatWorkoutText(workout.exercises),
    cooldown: formatWorkoutText(workout.cooldown),
    notes: workout.notes || '',
  }
}

function fromEditValues(values, workout) {
  const numberOrNull = (value) => value.trim() === '' ? null : Number(value)
  const linesToArray = (value) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return {
    ...workout,
    title: values.title.trim(),
    type: values.type.trim(),
    duration: values.duration.trim(),
    intensity: values.intensity,
    distanceKm: numberOrNull(values.distanceKm),
    pace: values.pace.trim(),
    speedKph: numberOrNull(values.speedKph),
    elevationGainM: numberOrNull(values.elevationGainM),
    warmup: linesToArray(values.warmup),
    exercises: linesToArray(values.exercises),
    cooldown: linesToArray(values.cooldown),
    notes: values.notes,
  }
}

function hasDisplayValue(value, rich = false) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string' || !value.trim()) return false
  if (!rich) return true
  const parsed = new DOMParser().parseFromString(sanitizeRichHtml(value), 'text/html')
  return Boolean(parsed.body.textContent?.trim())
}

function WorkoutDetails({
  day,
  workout,
  editing,
  editValues,
  disabled,
  onEdit,
  onCancel,
  onChange,
  onSave,
  onRemove,
  saveError,
  canEdit,
  isNew,
  onClose,
}) {
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
    <PopupShell
      title={`${day.label} ${day.date} · ${editing ? 'edit workout' : 'workout details'}`}
      onClose={onClose}
      actions={editing ? (
        <div className="popup-actions-row">
          {!isNew && (
            <Button variant="danger" onClick={onRemove} disabled={disabled || !canEdit}>
              Remove activity
            </Button>
          )}
          <Button onClick={onCancel} disabled={disabled}>Cancel</Button>
          <Button variant="accent" onClick={onSave} disabled={disabled}>
            {disabled ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      ) : (
        <Button variant="accent" onClick={onEdit} disabled={!canEdit}>Edit activity</Button>
      )}
    >
      {saveError && <p className="week-status week-status--error" role="alert">{saveError}</p>}
      {editing ? (
        <div className="week-edit-fields">
          {[
            ['title', 'Activity name'],
            ['duration', 'Duration (h:mm)'],
            ['distanceKm', 'Distance (km)'],
            ['pace', 'Pace'],
            ['speedKph', 'Speed (km/h)'],
            ['elevationGainM', 'Elevation gain (m)'],
          ].map(([field, label]) => (
            <label className="week-edit-field" key={field}>
              <span>{label}</span>
              <input
                type={['distanceKm', 'speedKph', 'elevationGainM'].includes(field) ? 'number' : 'text'}
                min="0"
                step={field === 'elevationGainM' ? '1' : '0.01'}
                value={editValues[field]}
                onChange={(event) => onChange(field, event.target.value)}
                disabled={disabled}
              />
            </label>
          ))}
          <label className="week-edit-field">
            <span>Activity</span>
            <select
              value={editValues.type}
              onChange={(event) => onChange('type', event.target.value)}
              disabled={disabled}
            >
              <option value="">—</option>
              {editValues.type && !ACTIVITY_OPTIONS.some(([value]) => value === editValues.type) && (
                <option value={editValues.type}>
                  {editValues.type.replaceAll('_', ' ')}
                </option>
              )}
              {ACTIVITY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="week-edit-field">
            <span>Intensity</span>
            <select
              value={editValues.intensity}
              onChange={(event) => onChange('intensity', event.target.value)}
              disabled={disabled}
            >
              <option value="">—</option>
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          {[
            ['warmup', 'Warm-up'],
            ['exercises', 'Workout details'],
            ['cooldown', 'Cool-down'],
            ['notes', 'Additional notes'],
          ].map(([field, label]) => (
            <label className="week-edit-field week-edit-field--wide" key={field}>
              <span>{label} (one item per line)</span>
              <textarea
                rows={field === 'notes' ? 3 : 4}
                value={editValues[field]}
                onChange={(event) => onChange(field, event.target.value)}
                disabled={disabled}
              />
            </label>
          ))}
        </div>
      ) : details.map(([label, value, rich]) => (
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
  const [activities, setActivities] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityError, setActivityError] = useState('')
  const [savingDate, setSavingDate] = useState(null)
  const [activeDay, setActiveDay] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadWeek() {
      let currentPlan
      try {
        currentPlan = await getCurrentWorkoutPlan()
      } catch (loadError) {
        if (!cancelled && loadError.status !== 503) {
          setError(loadError.message || 'Could not load the current plan.')
        }
        return
      }

      if (cancelled) return
      setPlan(currentPlan)
      if (!currentPlan) return

      try {
        const loaded = await getWorkoutActivities(currentPlan.id)
        if (!cancelled) {
          setActivities(Object.fromEntries(
            loaded.map((activity) => [activity.workout_date, activity]),
          ))
        }
      } catch (loadError) {
        if (!cancelled) {
          setActivityError(loadError.status === 503
            ? 'Workout activity storage is unavailable. Apply the 20261015101100_create_workout_plan_activities.sql migration to enable editing and completion.'
            : loadError.message || 'Could not load workout activities.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadWeek().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const days = getDisplayedDays(plan).map((day) => ({
    ...day,
    activities: getDayActivities(day, activities[day.key]),
  }))

  async function toggleDone(day, activityIndex) {
    if (!plan || savingDate) return
    setSavingDate(day.key)
    setSaveError('')

    try {
      const dayActivities = day.activities.map((activity, index) => (
        index === activityIndex ? { ...activity, completed: !activity.completed } : activity
      ))
      await saveDayActivities(day, dayActivities)
    } catch (updateError) {
      setSaveError(updateError.message || 'Could not update workout completion.')
    } finally {
      setSavingDate(null)
    }
  }

  function startEditing() {
    setEditValues(toEditValues(activeDay.workout))
    setEditing(true)
    setSaveError('')
  }

  function addActivity(day) {
    if (activityError) return
    const workout = createEmptyActivity(day)
    setActiveDay({
      ...day,
      workout,
      activityIndex: null,
    })
    setEditValues(toEditValues(workout))
    setEditing(true)
    setSaveError('')
  }

  async function saveDayActivities(day, dayActivities) {
    const saved = await saveWorkoutActivity(plan.id, day.key, dayActivities)
    setActivities((current) => ({ ...current, [day.key]: saved }))
    return saved
  }

  async function saveEdits() {
    if (!activeDay || !editValues || !plan || savingDate) return
    const workout = fromEditValues(editValues, activeDay.workout)
    if (!workout.type) {
      setSaveError('Select an activity type before saving.')
      return
    }
    setSavingDate(activeDay.key)
    setSaveError('')
    try {
      const day = days.find((entry) => entry.key === activeDay.key)
      if (!day) throw new Error('The selected day is no longer available.')
      const dayActivities = [...day.activities]
      let activityIndex = activeDay.activityIndex
      if (activeDay.activityIndex == null) {
        dayActivities.push(workout)
        activityIndex = dayActivities.length - 1
      } else {
        dayActivities[activeDay.activityIndex] = workout
      }
      await saveDayActivities(day, dayActivities)
      setActiveDay((current) => current ? { ...current, workout, activityIndex } : current)
      setEditing(false)
    } catch (updateError) {
      setSaveError(updateError.message || 'Could not save activity changes.')
    } finally {
      setSavingDate(null)
    }
  }

  async function removeActivity() {
    if (!activeDay || activeDay.activityIndex == null || !plan || savingDate) return
    const day = days.find((entry) => entry.key === activeDay.key)
    if (!day) return
    setSavingDate(activeDay.key)
    setSaveError('')
    try {
      const dayActivities = day.activities.filter((_, index) => index !== activeDay.activityIndex)
      await saveDayActivities(day, dayActivities)
      setActiveDay(null)
      setEditing(false)
    } catch (updateError) {
      setSaveError(updateError.message || 'Could not remove activity.')
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
      {activityError && plan && (
        <p className="week-status week-status--error" role="alert">
          {activityError}
        </p>
      )}
      {saveError && <p className="week-status week-status--error" role="alert">{saveError}</p>}
      {!loading && !error && !plan && (
        <p className="week-status">No workout plans available. Select a workout plan to display.</p>
      )}

      {!loading && !error && (
        <div className="week-days">
          {days.map((day) => {
            const allDone = day.activities.length > 0 && day.activities.every((activity) => activity.completed)
            return (
              <article
                key={day.key}
                className={`week-day${day.isToday ? ' week-day--today' : ''}${allDone ? ' week-day--done' : ''}`}
              >
                <div className="week-day-heading">
                  <span className="week-day-name">{day.label}</span>
                  <span className="week-day-date">{day.date}</span>
                </div>

                {day.activities.length > 0 ? (
                  <div className="week-activities-list">
                    {day.activities.map((workout, activityIndex) => {
                      const title = workout.title?.trim()
                        || workout.type?.replaceAll('_', ' ')
                        || 'Activity'
                      const summary = getWeekCardSummary(workout)
                      return (
                        <div className="week-activity-item" key={`${day.key}-${activityIndex}`}>
                          <button
                            type="button"
                            className={`week-workout-name${workout.completed ? ' week-workout-name--done' : ''}`}
                            onClick={() => setActiveDay({ ...day, workout, activityIndex })}
                          >
                            <span>{title}</span>
                            {summary && <small>{summary}</small>}
                          </button>
                          <label className="week-done-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(workout.completed)}
                              disabled={savingDate !== null || Boolean(activityError)}
                              onChange={() => toggleDone(day, activityIndex)}
                              aria-label={`Mark ${title} as ${workout.completed ? 'not done' : 'done'}`}
                            />
                            <span>Done</span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="week-day-empty">
                    {day.workout?.type === 'rest'
                      ? day.workout.title?.trim() || 'Rest day'
                      : 'No workout planned'}
                  </p>
                )}
                <div className="week-day-footer">
                  <button
                    type="button"
                    className="week-add-activity"
                    disabled={savingDate !== null || Boolean(activityError)}
                    onClick={() => addActivity(day)}
                  >
                    + Add activity
                  </button>
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
          editing={editing}
          editValues={editValues || toEditValues(activeDay.workout)}
          disabled={savingDate === activeDay.key}
          onEdit={startEditing}
          onCancel={() => setEditing(false)}
          onChange={(field, value) => setEditValues((current) => ({ ...current, [field]: value }))}
          onSave={saveEdits}
          onRemove={removeActivity}
          saveError={saveError}
          canEdit={!activityError}
          isNew={activeDay.activityIndex == null}
          onClose={() => {
            if (savingDate !== activeDay.key) {
              setActiveDay(null)
              setEditing(false)
            }
          }}
        />
      )}
    </section>
  )
}
