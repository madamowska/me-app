import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import RichTextarea from '../../components/ui/RichTextarea'
import {
  deleteWorkoutPlan,
  generateWorkoutPlan,
  getWorkoutPlans,
  saveWorkoutPlan,
  updateWorkoutPlan,
} from '../../features/plan/api'
import { ACTIVITY_OPTIONS } from '../../features/plan/activityOptions'
import { normalizeWorkoutPlan } from '../../../../shared/workoutPlan.js'
import './Plan.css'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TITLE_SUGGESTIONS = {
  rest: 'Rest day',
  running: 'Run',
  cycling: 'Bike',
  swimming: 'Swim',
  strength_training: 'Strength training',
  climbing: 'Bouldering',
  hiking: 'Hike',
  walking: 'Walk',
  'stretching/yoga': 'Mobility',
}

const PARAMETERS_BY_ACTIVITY = {
  rest: [],
  running: [
    { name: 'distanceKm', label: 'Distance (km)', kind: 'decimal' },
    { name: 'pace', label: 'Pace (min/km)', kind: 'pace' },
    { name: 'duration', label: 'Duration (h:mm)', kind: 'duration' },
    { name: 'intensity', label: 'Intensity', kind: 'intensity' },
  ],
  cycling: [
    { name: 'distanceKm', label: 'Distance (km)', kind: 'decimal' },
    { name: 'speedKph', label: 'Speed (km/h)', kind: 'decimal' },
    { name: 'duration', label: 'Duration (h:mm)', kind: 'duration' },
    { name: 'intensity', label: 'Intensity', kind: 'intensity' },
  ],
  swimming: [
    { name: 'distanceKm', label: 'Distance (km)', kind: 'decimal' },
    { name: 'pace', label: 'Pace (min/100m)', kind: 'pace' },
    { name: 'duration', label: 'Duration (h:mm)', kind: 'duration' },
    { name: 'intensity', label: 'Intensity', kind: 'intensity' },
  ],
  strength_training: [
    { name: 'duration', label: 'Duration (h:mm)', kind: 'duration' },
    { name: 'intensity', label: 'Intensity', kind: 'intensity' },
  ],
  climbing: [
    { name: 'duration', label: 'Duration (h:mm)', kind: 'duration' },
    { name: 'intensity', label: 'Intensity', kind: 'intensity' },
  ],
  hiking: [
    { name: 'distanceKm', label: 'Distance (km)', kind: 'decimal' },
    { name: 'elevationGainM', label: 'Elevation gain (m)', kind: 'number', step: '1' },
    { name: 'duration', label: 'Duration (h:mm)', kind: 'duration' },
    { name: 'intensity', label: 'Intensity', kind: 'intensity' },
  ],
  walking: [
    { name: 'distanceKm', label: 'Distance (km)', kind: 'decimal' },
    { name: 'pace', label: 'Pace (min/km)', kind: 'pace' },
    { name: 'duration', label: 'Duration (h:mm)', kind: 'duration' },
    { name: 'intensity', label: 'Intensity', kind: 'intensity' },
  ],
  'stretching/yoga': [
    { name: 'duration', label: 'Duration (h:mm)', kind: 'duration' },
    { name: 'intensity', label: 'Intensity', kind: 'intensity' },
  ],
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function currentWeekMonday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return toDateKey(date)
}

function mondayForDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return toDateKey(date)
}

function addDays(dateKey, count) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + count)
  return toDateKey(date)
}

function makeEmptyPlan(weekStart) {
  return {
    summary: '',
    recoveryNotes: [],
    days: WEEKDAYS.map((day, index) => ({
      day,
      date: addDays(weekStart, index),
      type: '',
      title: '',
      duration: '',
      intensity: '',
      warmup: '',
      exercises: '',
      cooldown: '',
      notes: '',
      distanceKm: '',
      pace: '',
      speedKph: '',
      elevationGainM: null,
    })),
  }
}

function normalizeGeneratedPlan(plan) {
  const canonicalPlan = normalizeWorkoutPlan(plan)
  return {
    summary: canonicalPlan.summary,
    recoveryNotes: canonicalPlan.recoveryNotes,
    days: canonicalPlan.days.map((day) => {
      const { durationMinutes, ...editableDay } = day
      return {
        ...editableDay,
        duration: durationMinutes == null ? '' : formatTotalMinutes(durationMinutes),
        warmup: day.warmup.join('\n'),
        exercises: day.exercises.join('\n'),
        cooldown: day.cooldown.join('\n'),
        distanceKm: typeof day.distanceKm === 'number' ? day.distanceKm.toFixed(2) : '',
        pace: typeof day.pace === 'string' ? normalizePace(day.pace) ?? day.pace : '',
        speedKph: typeof day.speedKph === 'number' ? day.speedKph.toFixed(2) : '',
        elevationGainM: typeof day.elevationGainM === 'number' ? day.elevationGainM : null,
      }
    }),
  }
}

function formatTotalMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

function normalizeDuration(value) {
  if (typeof value !== 'string') return null
  const duration = value.trim()
  if (!duration) return ''
  const legacy = duration.match(/^(\d+)\s*(min|h)$/i)
  if (legacy) {
    const amount = Number(legacy[1])
    if (!Number.isSafeInteger(amount)) return null
    return legacy[2].toLowerCase() === 'h'
      ? `${amount}:00`
      : formatTotalMinutes(amount)
  }

  if (/^\d+$/.test(duration)) {
    const totalMinutes = Number(duration)
    return Number.isSafeInteger(totalMinutes) ? formatTotalMinutes(totalMinutes) : null
  }

  const match = duration.match(/^(\d+):(\d{1,2})$/)
  if (!match || Number(match[2]) > 59) return null
  return `${Number(match[1])}:${match[2].padStart(2, '0')}`
}

function durationToMinutes(value, type) {
  const normalized = normalizeDuration(value)
  if (normalized === null) return null
  if (!normalized) return type === 'rest' ? 0 : null
  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

function normalizePace(value) {
  if (typeof value !== 'string') return null
  const pace = value.trim()
  if (!pace) return ''
  const match = pace.match(/^(\d+):(\d{1,2})(?:\s*(?:min\/km|min\/100m))?$/i)
    || pace.match(/^(\d+)\s*(?:min\/km|min\/100m)$/i)
  if (!match) return null
  const minutes = Number(match[1])
  const seconds = match[2] === undefined ? 0 : Number(match[2])
  if (!Number.isSafeInteger(minutes) || seconds > 59) return null
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function linesToArray(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function updateMetric(day, parameter, value) {
  if (parameter.name === 'duration') {
    return { ...day, duration: value }
  }
  if (parameter.kind === 'number') {
    return { ...day, [parameter.name]: value === '' ? null : Number(value) }
  }
  return { ...day, [parameter.name]: value }
}

function MetricField({ day, parameter, onChange }) {
  if (parameter.kind === 'intensity') {
    return (
      <label className="plan-field">
        <span>{parameter.label}</span>
        <select value={day.intensity} onChange={(event) => onChange(event.target.value)}>
          <option value="">—</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
        </select>
      </label>
    )
  }

  const value = day[parameter.name] ?? ''
  const inputMode = parameter.kind === 'decimal' ? 'decimal' : 'numeric'
  const pattern = parameter.kind === 'decimal'
    ? '\\d+(\\.\\d{1,2})?'
    : parameter.kind === 'duration' || parameter.kind === 'pace'
      ? '\\d+(?::\\d{1,2})?'
      : undefined
  const maxLength = parameter.kind === 'duration' || parameter.kind === 'pace' ? 9 : undefined

  return (
    <label className="plan-field">
      <span>{parameter.label}</span>
      <input
        type={parameter.kind === 'number' ? 'number' : 'text'}
        inputMode={parameter.kind === 'number' ? undefined : inputMode}
        min={parameter.kind === 'number' ? '0' : undefined}
        step={parameter.kind === 'number' ? parameter.step : undefined}
        pattern={pattern}
        maxLength={maxLength}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value
          if (parameter.kind === 'number') {
            onChange(nextValue)
            return
          }
          const isValidInput = parameter.kind === 'decimal'
            ? nextValue === '' || /^\d+(\.\d{0,2})?$/.test(nextValue)
            : nextValue === '' || /^\d{0,6}(?::\d{0,2})?$/.test(nextValue)
          if (isValidInput) onChange(nextValue)
        }}
        onBlur={() => {
          if (parameter.kind === 'decimal' && value !== '' && /^\d+(\.\d{0,2})?$/.test(value)) {
            onChange(Number(value).toFixed(2))
          } else if (parameter.kind === 'duration') {
            onChange(normalizeDuration(value) || value)
          } else if (parameter.kind === 'pace') {
            onChange(normalizePace(value) ?? value)
          }
        }}
      />
    </label>
  )
}

function PlanDayEditor({ day, index, onChange }) {
  const parameters = PARAMETERS_BY_ACTIVITY[day.type] || []

  function update(field, value) {
    onChange(index, { ...day, [field]: value })
  }

  function changeActivity(type) {
    const previousSuggestion = TITLE_SUGGESTIONS[day.type] || ''
    const nextSuggestion = TITLE_SUGGESTIONS[type] || ''
    onChange(index, {
      ...day,
      type,
      title: !day.title.trim() || day.title === previousSuggestion ? nextSuggestion : day.title,
      duration: day.type === 'rest' || type === 'rest' ? '' : day.duration,
      warmup: type === 'rest' ? '' : day.warmup,
      exercises: type === 'rest' ? '' : day.exercises,
      cooldown: type === 'rest' ? '' : day.cooldown,
      distanceKm: '',
      pace: '',
      speedKph: '',
      elevationGainM: null,
      intensity: 'easy',
    })
  }

  return (
    <article className="plan-day-editor">
      <header className="plan-day-editor-header">
        <span className="plan-day-editor-date">{day.day}</span>
        <span className="plan-day-editor-date-value">{day.date}</span>
      </header>

      <div className="plan-day-row plan-day-primary-row">
        <label className="plan-field">
          <span>Activity</span>
          <select value={day.type} onChange={(event) => changeActivity(event.target.value)}>
            <option value="">—</option>
            {ACTIVITY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="plan-field plan-field--title">
          <span>Title</span>
          <input
            type="text"
            value={day.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder={TITLE_SUGGESTIONS[day.type] || 'Workout title'}
            maxLength="160"
          />
        </label>
      </div>

      {parameters.length > 0 && (
        <div className="plan-day-row plan-day-parameters">
          {parameters.map((parameter) => (
            <MetricField
              key={parameter.name}
              day={day}
              parameter={parameter}
              onChange={(value) => onChange(index, updateMetric(day, parameter, value))}
            />
          ))}
        </div>
      )}

      {day.type !== 'rest' && (
        <div className="plan-day-row plan-day-text-fields">
          {[
            ['warmup', 'Warm-up', 4000],
            ['exercises', 'Workout', 4000],
            ['cooldown', 'Cool-down', 4000],
          ].map(([field, label, maxLength]) => (
            <label className="plan-field" key={field}>
              <span>{label}</span>
              <RichTextarea
                value={day[field]}
                onChange={(value) => update(field, value)}
                maxLength={maxLength}
              />
            </label>
          ))}
        </div>
      )}
      <div className="plan-day-row plan-day-notes-row">
        <label className="plan-field">
          <span>Additional notes</span>
          <RichTextarea
            value={day.notes}
            onChange={(value) => update('notes', value)}
            maxLength={2000}
          />
        </label>
      </div>
    </article>
  )
}

export default function CreateWorkoutPlan() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialWeek = currentWeekMonday()
  const [weekStart, setWeekStart] = useState(initialWeek)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState(() => makeEmptyPlan(initialWeek))
  const [loadingPlan, setLoadingPlan] = useState(Boolean(searchParams.get('planId')))
  const [generating, setGenerating] = useState(() => searchParams.get('mode') === 'generate')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const generatedOnLoad = useRef(false)
  const generatePlan = searchParams.get('mode') === 'generate'
  const editPlanId = searchParams.get('planId')

  useEffect(() => {
    if (!editPlanId) return undefined
    let cancelled = false
    setLoadingPlan(true)
    getWorkoutPlans()
      .then((plans) => {
        const plan = plans.find((entry) => entry.id === editPlanId)
        if (!plan) throw new Error('Workout plan was not found.')
        if (cancelled) return
        setTitle(plan.title)
        setWeekStart(plan.week_start)
        setDraft(normalizeGeneratedPlan(plan.plan_data))
      })
      .catch((error) => {
        if (cancelled) return
        setMessage(error.message || 'Could not load workout plan for editing.')
        setIsError(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingPlan(false)
      })
    return () => {
      cancelled = true
    }
  }, [editPlanId])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setMessage('Generating a personalised week with LM Studio…')
    setIsError(false)
    try {
      const generated = await generateWorkoutPlan({ weekStart })
      setDraft(normalizeGeneratedPlan(generated))
      setTitle(`Workout plan · ${generated.weekStart}`)
      setMessage('Generated plan is ready. Review it, then save it.')
    } catch (error) {
      setMessage(error.message || 'Could not generate a workout plan.')
      setIsError(true)
    } finally {
      setGenerating(false)
    }
  }, [weekStart])

  useEffect(() => {
    if (generatePlan && !generatedOnLoad.current) {
      generatedOnLoad.current = true
      handleGenerate()
    }
  }, [generatePlan, handleGenerate])

  function changeWeekStart(value) {
    const monday = mondayForDate(value)
    setWeekStart(monday)
    setDraft((current) => ({
      ...current,
      days: current.days.map((day, index) => ({
        ...day,
        day: WEEKDAYS[index],
        date: addDays(monday, index),
      })),
    }))
  }

  function updateDay(index, day) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((entry, dayIndex) => dayIndex === index ? day : entry),
    }))
  }

  async function handleSave(event) {
    event.preventDefault()
    const days = []
    for (const [index, day] of draft.days.entries()) {
      const pace = normalizePace(day.pace)
      if (pace === null) {
        setMessage(`${day.day}: enter pace as M:SS, such as 5:30.`)
        setIsError(true)
        return
      }

      const durationMinutes = durationToMinutes(day.duration, day.type)
      if (durationMinutes === null) {
        setMessage(`${day.day}: enter duration as H:MM, such as 1:30.`)
        setIsError(true)
        return
      }

      const normalizedDay = {
        day: day.day,
        date: day.date,
        type: day.type,
        title: day.title.trim(),
        durationMinutes,
        intensity: day.intensity,
        warmup: linesToArray(day.warmup),
        exercises: linesToArray(day.exercises),
        cooldown: linesToArray(day.cooldown),
        notes: day.notes,
        pace,
      }
      for (const field of ['distanceKm', 'speedKph']) {
        const value = day[field]
        if (value === '' || value === null || value === undefined) {
          normalizedDay[field] = null
        } else if (
          (typeof value === 'number' && Number.isFinite(value) && value >= 0)
          || (typeof value === 'string' && /^\d+(\.\d{0,2})?$/.test(value) && Number.isFinite(Number(value)))
        ) {
          normalizedDay[field] = Number(Number(value).toFixed(2))
        } else {
          setMessage(`${day.day}: ${field === 'distanceKm' ? 'distance' : 'speed'} must use the format X.XX.`)
          setIsError(true)
          return
        }
      }
      normalizedDay.elevationGainM = day.elevationGainM == null ? null : Number(day.elevationGainM)
      days[index] = normalizedDay
    }

    setSaving(true)
    setMessage('')
    setIsError(false)
    try {
      const planTitle = title.trim() || `Workout plan · ${weekStart}`
      const planData = normalizeWorkoutPlan({ ...draft, days })
      if (editPlanId) {
        await updateWorkoutPlan(editPlanId, { title: planTitle, weekStart, planData })
      } else {
        await saveWorkoutPlan({ title: planTitle, weekStart, planData })
      }
      navigate('/plan')
    } catch (error) {
      setMessage(error.message || 'Could not save workout plan.')
      setIsError(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editPlanId || !window.confirm('Delete this workout plan? This cannot be undone.')) return
    setDeleting(true)
    setMessage('')
    setIsError(false)
    try {
      await deleteWorkoutPlan(editPlanId)
      navigate('/plan')
    } catch (error) {
      setMessage(error.message || 'Could not delete workout plan.')
      setIsError(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="plan-page plan-create-page">
      <div className="plan-page-shell">
        <header className="plan-page-header plan-create-page-header">
          <div>
            <p className="plan-eyebrow">Training</p>
            <h1>{editPlanId ? 'Edit a workout plan' : 'Create a workout plan'}</h1>
          </div>
        </header>

        {generating ? (
          <section className="plan-generation-loading" role="status" aria-live="polite">
            <span className="plan-generation-spinner" aria-hidden="true" />
            <h2>Creating your workout plan</h2>
            <p>LM Studio is building a personalised training week. This may take a few moments.</p>
          </section>
        ) : (
        <form className="plan-create-form" onSubmit={handleSave} aria-busy={loadingPlan}>
          {loadingPlan && <p className="saved-plans-empty" role="status">Loading workout plan…</p>}
          <div className="plan-metadata">
            <label className="plan-field">
              <span>Plan name</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`Workout plan · ${weekStart}`}
                maxLength="120"
              />
            </label>
            <label className="plan-field">
              <span>Week starting Monday</span>
              <input
                type="date"
                value={weekStart}
                onChange={(event) => {
                  if (event.target.value) changeWeekStart(event.target.value)
                }}
                disabled={generating}
              />
            </label>
          </div>

          <label className="plan-field">
            <span>Week overview</span>
            <textarea
              rows="2"
              value={draft.summary}
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
              maxLength="4000"
              placeholder="What is the focus of this week?"
            />
          </label>

          <div className="plan-days-editor">
            {draft.days.map((day, index) => (
              <PlanDayEditor key={day.date} day={day} index={index} onChange={updateDay} />
            ))}
          </div>

          <label className="plan-field">
            <span>Recovery notes</span>
            <textarea
              rows="2"
              value={arrayToLines(draft.recoveryNotes)}
              onChange={(event) => setDraft((current) => ({
                ...current,
                recoveryNotes: linesToArray(event.target.value),
              }))}
              placeholder="One per line"
            />
          </label>

          {message && (
            <p className={`plan-message${isError ? ' plan-message--error' : ''}`} role={isError ? 'alert' : 'status'}>
              {message}
            </p>
          )}

          <div className="plan-save-row">
            <Button type="button" onClick={handleGenerate} disabled={saving || generating || deleting}>
              {generating ? 'Generating…' : 'Regenerate with LM Studio'}
            </Button>
            <Button type="button" onClick={() => navigate('/plan')} disabled={saving || generating || deleting}>
              Cancel
            </Button>
            {editPlanId && (
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={saving || generating || loadingPlan || deleting}
              >
                {deleting ? 'Deleting…' : 'Delete workout plan'}
              </Button>
            )}
            <Button type="submit" variant="accent" disabled={saving || generating || loadingPlan || deleting}>
              {saving ? 'Saving…' : editPlanId ? 'Save changes' : 'Save workout plan'}
            </Button>
          </div>
        </form>
        )}
      </div>
    </main>
  )
}
