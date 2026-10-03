import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import './AthleteProfile.css'

const WEEKDAYS = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
]

const ACTIVITIES = [
  ['running', 'Running'],
  ['cycling', 'Cycling'],
  ['swimming', 'Swimming'],
  ['strength_training', 'Strength training'],
  ['climbing', 'Climbing'],
  ['hiking', 'Hiking'],
  ['walking', 'Walking'],
]

const EMPTY_PROFILE = {
  name: '',
  date_of_birth: '',
  height_cm: '',
  weight_kg: '',
  gender: '',
  primary_activity: '',
  goals: '',
  activities: [],
  available_days: [],
  description: '',
}

function toDraft(profile) {
  return {
    name: profile.name ?? '',
    date_of_birth: profile.date_of_birth ?? '',
    height_cm: profile.height_cm == null ? '' : String(profile.height_cm),
    weight_kg: profile.weight_kg == null ? '' : String(profile.weight_kg),
    gender: profile.gender ?? '',
    primary_activity: profile.primary_activity ?? '',
    goals: profile.goals ?? '',
    activities: Array.isArray(profile.activities) ? [...profile.activities] : [],
    available_days: Array.isArray(profile.available_days) ? [...profile.available_days] : [],
    description: profile.description ?? '',
  }
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return 'Not set'
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(', ') : 'Not set'
  }
  if (typeof value === 'object') {
    return Object.keys(value).length ? JSON.stringify(value, null, 2) : 'Not set'
  }
  return String(value)
}

async function readError(response, fallback) {
  const body = await response.json().catch(() => ({}))
  return body.error || fallback
}

export default function AthleteProfile() {
  const [profile, setProfile] = useState(null)
  const [draft, setDraft] = useState(EMPTY_PROFILE)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      setLoading(true)
      setMessage('')
      setError(false)
      try {
        const response = await fetch('/api/athlete-profile')
        if (!response.ok) {
          throw new Error(await readError(response, 'Could not load athlete profile.'))
        }

        const result = await response.json()
        if (!result.profile || typeof result.profile !== 'object') {
          throw new Error('The server returned an invalid athlete profile.')
        }
        if (!cancelled) {
          setProfile(result.profile)
          setDraft(toDraft(result.profile))
          setEditing(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(true)
          setMessage(loadError.message || 'Could not load athlete profile.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function toggleAvailableDay(day) {
    setDraft((current) => ({
      ...current,
      available_days: current.available_days.includes(day)
        ? current.available_days.filter((availableDay) => availableDay !== day)
        : [...current.available_days, day],
    }))
  }

  function toggleActivity(activity) {
    setDraft((current) => ({
      ...current,
      activities: current.activities.includes(activity)
        ? current.activities.filter((selectedActivity) => selectedActivity !== activity)
        : [...current.activities, activity],
    }))
  }

  function cancelEditing() {
    if (profile) {
      setDraft(toDraft(profile))
    }
    setEditing(false)
    setMessage('')
    setError(false)
  }

  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError(false)

    const payload = {
      name: draft.name.trim() || null,
      date_of_birth: draft.date_of_birth || null,
      height_cm: draft.height_cm === '' ? null : Number(draft.height_cm),
      weight_kg: draft.weight_kg === '' ? null : Number(draft.weight_kg),
      gender: draft.gender || null,
      primary_activity: draft.primary_activity || null,
      goals: draft.goals.trim(),
      activities: draft.activities,
      available_days: draft.available_days,
      description: draft.description.trim(),
    }

    try {
      const response = await fetch('/api/athlete-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not save athlete profile.'))
      }

      const result = await response.json()
      if (!result.profile || typeof result.profile !== 'object') {
        throw new Error('The server did not confirm the saved athlete profile.')
      }
      setProfile(result.profile)
      setDraft(toDraft(result.profile))
      setEditing(false)
      setMessage('Profile saved.')
    } catch (saveError) {
      setError(true)
      setMessage(saveError.message || 'Could not save athlete profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="athlete-profile-page">
      <section className="athlete-profile" aria-labelledby="athlete-profile-title">
        <div className="athlete-profile-header">
          <h1 id="athlete-profile-title">Athlete Profile</h1>
          {profile && !loading && !editing && (
            <Button variant="sm" onClick={() => {
              setMessage('')
              setError(false)
              setEditing(true)
            }}>
              Edit
            </Button>
          )}
        </div>

        {loading && <p className="athlete-profile-message" role="status">Loading profile…</p>}
        {!loading && !profile && !message && (
          <p className="athlete-profile-message">No athlete profile is available.</p>
        )}

        {!loading && profile && !editing && (
          <dl className="athlete-profile-list">
            <div><dt>Name</dt><dd>{displayValue(profile.name)}</dd></div>
            <div><dt>Date of birth</dt><dd>{displayValue(profile.date_of_birth)}</dd></div>
            <div><dt>Height</dt><dd>{profile.height_cm == null ? 'Not set' : `${profile.height_cm} cm`}</dd></div>
            <div><dt>Weight</dt><dd>{profile.weight_kg == null ? 'Not set' : `${profile.weight_kg} kg`}</dd></div>
            <div><dt>Gender</dt><dd>{displayValue(profile.gender)}</dd></div>
            <div><dt>Primary activity</dt><dd>{displayValue(
              ACTIVITIES.find(([value]) => value === profile.primary_activity)?.[1] ?? profile.primary_activity
            )}</dd></div>
            <div><dt>Goals</dt><dd>{displayValue(profile.goals)}</dd></div>
            <div className="athlete-profile-preferences">
              <dt>Description</dt>
              <dd>{displayValue(profile.description)}</dd>
            </div>
            <div><dt>Activities</dt><dd>{displayValue(profile.activities)}</dd></div>
            <div><dt>Available days</dt><dd>{displayValue(profile.available_days)}</dd></div>
          </dl>
        )}

        {!loading && profile && editing && (
          <form className="athlete-profile-form" onSubmit={saveProfile}>
            <label className="athlete-profile-field">
              <span>Name</span>
              <input type="text" maxLength={120} value={draft.name}
                onChange={(event) => updateDraft('name', event.target.value)} />
            </label>
            <label className="athlete-profile-field">
              <span>Date of birth</span>
              <input type="date" value={draft.date_of_birth}
                onChange={(event) => updateDraft('date_of_birth', event.target.value)} />
            </label>
            <div className="athlete-profile-number-row">
              <label className="athlete-profile-field">
                <span>Height (cm)</span>
                <input type="number" min="30" max="300" step="0.1" value={draft.height_cm}
                  onChange={(event) => updateDraft('height_cm', event.target.value)} />
              </label>
              <label className="athlete-profile-field">
                <span>Weight (kg)</span>
                <input type="number" min="2" max="700" step="0.1" value={draft.weight_kg}
                  onChange={(event) => updateDraft('weight_kg', event.target.value)} />
              </label>
            </div>
            <label className="athlete-profile-field">
              <span>Gender</span>
              <select value={draft.gender}
                onChange={(event) => updateDraft('gender', event.target.value)}>
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>
            <label className="athlete-profile-field">
              <span>Primary activity</span>
              <select value={draft.primary_activity}
                onChange={(event) => updateDraft('primary_activity', event.target.value)}>
                <option value="">Select primary activity</option>
                {ACTIVITIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <fieldset className="athlete-profile-days">
              <legend>Activities</legend>
              {ACTIVITIES.map(([activity, label]) => (
                <label key={activity}>
                  <input
                    type="checkbox"
                    checked={draft.activities.includes(activity)}
                    onChange={() => toggleActivity(activity)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="athlete-profile-field">
              <span>Goals</span>
              <textarea rows={5} maxLength={2000} value={draft.goals}
                onChange={(event) => updateDraft('goals', event.target.value)} />
            </label>
            <label className="athlete-profile-field">
              <span>Description</span>
              <textarea rows={5} maxLength={4000} value={draft.description}
                onChange={(event) => updateDraft('description', event.target.value)} />
            </label>
            <fieldset className="athlete-profile-days">
              <legend>Available days</legend>
              {WEEKDAYS.map(([day, label]) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={draft.available_days.includes(day)}
                    onChange={() => toggleAvailableDay(day)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="athlete-profile-actions">
              <Button type="button" onClick={cancelEditing} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="accent" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        )}

        {message && (
          <p className={`athlete-profile-message${error ? ' athlete-profile-message--error' : ''}`}
            role={error ? 'alert' : 'status'}>
            {message}
          </p>
        )}
      </section>
    </main>
  )
}
