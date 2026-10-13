import { useState } from 'react'
import Button from '../../components/ui/Button'
import PopupShell from '../../components/popups/PopupShell'
import './WeekSection.css'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays() {
  const today = new Date()
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))

  return WEEKDAYS.map((label, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

    return {
      label,
      key,
      date: date.getDate(),
      isToday: key === [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-'),
    }
  })
}

function emptyWorkout() {
  return {
    name: '',
    type: 'Running',
    distance: '',
    pace: '',
    duration: '',
    comments: '',
    done: false,
  }
}

function WorkoutForm({ day, workout, onSave, onClose }) {
  const [values, setValues] = useState(() => workout ?? emptyWorkout())

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function submit(event) {
    event.preventDefault()
    onSave({ ...values, name: values.name.trim() || values.type })
  }

  return (
    <PopupShell
      title={`${workout ? 'Edit' : 'Add'} activity · ${day.label} ${day.date}`}
      onClose={onClose}
      actions={(
        <div className="popup-actions-row">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="accent" type="submit" form="week-workout-form">Save</Button>
        </div>
      )}
    >
      <form id="week-workout-form" className="week-workout-form" onSubmit={submit}>
        <label className="week-form-field">
          <span>Activity</span>
          <select value={values.type} onChange={(event) => update('type', event.target.value)}>
            <option>Running</option>
            <option>Climbing</option>
            <option>Stretching</option>
            <option>Mobility</option>
            <option>Walking</option>
            <option>Other</option>
          </select>
        </label>
        <label className="week-form-field">
          <span>Name</span>
          <input
            type="text"
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="e.g. Easy run"
          />
        </label>
        <div className="week-form-metrics">
          <label className="week-form-field">
            <span>Distance (km)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={values.distance}
              onChange={(event) => update('distance', event.target.value)}
            />
          </label>
          <label className="week-form-field">
            <span>Pace</span>
            <input
              type="text"
              value={values.pace}
              onChange={(event) => update('pace', event.target.value)}
              placeholder="e.g. 6:00 /km"
            />
          </label>
          <label className="week-form-field">
            <span>Duration (min)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={values.duration}
              onChange={(event) => update('duration', event.target.value)}
            />
          </label>
        </div>
        <label className="week-form-field">
          <span>Additional comments</span>
          <textarea
            rows="3"
            value={values.comments}
            onChange={(event) => update('comments', event.target.value)}
            placeholder="Anything to remember?"
          />
        </label>
      </form>
    </PopupShell>
  )
}

function WorkoutDetails({ day, workout, onEdit, onClose }) {
  const details = [
    ['Activity', workout.name],
    ['Type', workout.type],
    ['Distance', workout.distance ? `${workout.distance} km` : '—'],
    ['Pace', workout.pace || '—'],
    ['Duration', workout.duration ? `${workout.duration} min` : '—'],
    ['Comments', workout.comments || '—'],
  ]

  return (
    <PopupShell
      title={`${day.label} ${day.date} · activity details`}
      onClose={onClose}
      actions={(
        <div className="popup-actions-row">
          <Button onClick={onClose}>Close</Button>
          <Button variant="accent" onClick={onEdit}>Edit activity</Button>
        </div>
      )}
    >
      {details.map(([label, value]) => (
        <div className="detail-field" key={label}>
          <div className="detail-label">{label}</div>
          <div className="detail-value">{value}</div>
        </div>
      ))}
    </PopupShell>
  )
}

export default function WeekSection() {
  const [workouts, setWorkouts] = useState({})
  const [activeDay, setActiveDay] = useState(null)
  const [modal, setModal] = useState(null)
  const days = getWeekDays()

  function openEditor(day) {
    setActiveDay(day)
    setModal('edit')
  }

  function saveWorkout(workout) {
    setWorkouts((current) => ({ ...current, [activeDay.key]: workout }))
    setModal(null)
  }

  function toggleDone(day) {
    setWorkouts((current) => ({
      ...current,
      [day.key]: { ...current[day.key], done: !current[day.key].done },
    }))
  }

  return (
    <section className="week-section" aria-labelledby="week-section-title">
      <div className="week-section-header">
        <div>
          <h2 id="week-section-title">Week</h2>
          <p>Your plan, day by day</p>
        </div>
      </div>

      <div className="week-days">
        {days.map((day) => {
          const workout = workouts[day.key]

          return (
            <article
              key={day.key}
              className={`week-day${day.isToday ? ' week-day--today' : ''}${workout?.done ? ' week-day--done' : ''}`}
            >
              <div className="week-day-heading">
                <span className="week-day-name">{day.label}</span>
                <span className="week-day-date">{day.date}</span>
              </div>

              {workout ? (
                <button
                  type="button"
                  className={`week-workout-name${workout.done ? ' week-workout-name--done' : ''}`}
                  onClick={() => {
                    setActiveDay(day)
                    setModal('details')
                  }}
                >
                  {workout.name}
                </button>
              ) : (
                <p className="week-day-empty">No workout planned</p>
              )}

              <div className="week-day-footer">
                <label className={`week-done-toggle${!workout ? ' week-done-toggle--empty' : ''}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(workout?.done)}
                    disabled={!workout}
                    onChange={() => toggleDone(day)}
                    aria-label={`${workout?.done ? 'Mark as not done' : 'Mark as done'}${workout ? `: ${workout.name}` : ': no workout planned'}`}
                  />
                  <span>Done</span>
                </label>
                <Button
                  variant="accent"
                  className="week-add-button"
                  onClick={() => openEditor(day)}
                  aria-label={`${workout ? 'Edit' : 'Add'} activity for ${day.label}`}
                >
                  {workout ? 'Edit' : '+ Add'}
                </Button>
              </div>
            </article>
          )
        })}
      </div>

      {modal === 'edit' && activeDay && (
        <WorkoutForm
          key={activeDay.key}
          day={activeDay}
          workout={workouts[activeDay.key]}
          onSave={saveWorkout}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'details' && activeDay && workouts[activeDay.key] && (
        <WorkoutDetails
          day={activeDay}
          workout={workouts[activeDay.key]}
          onEdit={() => setModal('edit')}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  )
}
