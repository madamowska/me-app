import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button'

function getLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toFormValues(feedback) {
  return {
    soreness: feedback?.soreness == null ? '' : String(feedback.soreness),
    sleep_hours: feedback?.sleep_hours == null ? '' : String(feedback.sleep_hours),
    stress: feedback?.stress == null ? '' : String(feedback.stress),
    notes: feedback?.notes ?? '',
  }
}

function toPayload(values) {
  return {
    soreness: values.soreness === '' ? null : Number(values.soreness),
    sleep_hours: values.sleep_hours === '' ? null : Number(values.sleep_hours),
    stress: values.stress === '' ? null : Number(values.stress),
    notes: values.notes.trim() || null,
  }
}

async function readError(response, fallback) {
  const body = await response.json().catch(() => ({}))
  return body.error || fallback
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function RatingSelect({ label, value, onChange, disabled }) {
  return (
    <label className="daily-feedback-field">
      <span>{label} (1–5)</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">Not rated</option>
        {[1, 2, 3, 4, 5].map((rating) => (
          <option key={rating} value={rating}>{rating}</option>
        ))}
      </select>
    </label>
  )
}

function FeedbackFields({ values, onChange, disabled }) {
  return (
    <>
      <div className="daily-feedback-ratings">
        <RatingSelect
          label="Soreness"
          value={values.soreness}
          onChange={(value) => onChange('soreness', value)}
          disabled={disabled}
        />
        <label className="daily-feedback-field">
          <span>Sleep (hours)</span>
          <input
            type="number"
            min="0"
            max="24"
            step="0.1"
            value={values.sleep_hours}
            onChange={(event) => onChange('sleep_hours', event.target.value)}
            disabled={disabled}
          />
        </label>
        <RatingSelect
          label="Stress"
          value={values.stress}
          onChange={(value) => onChange('stress', value)}
          disabled={disabled}
        />
      </div>
      <label className="daily-feedback-field">
        <span>Notes</span>
        <textarea
          rows={3}
          maxLength={3000}
          value={values.notes}
          onChange={(event) => onChange('notes', event.target.value)}
          disabled={disabled}
        />
      </label>
    </>
  )
}

export default function DailyFeedback() {
  const [date] = useState(getLocalDate)
  const [values, setValues] = useState(() => toFormValues(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [editValues, setEditValues] = useState(() => toFormValues(null))
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const messageTimer = useRef(null)

  useEffect(() => {
    if (messageTimer.current) {
      clearTimeout(messageTimer.current)
      messageTimer.current = null
    }

    if (message === 'Daily feedback saved.') {
      messageTimer.current = window.setTimeout(() => {
        setMessage('')
        messageTimer.current = null
      }, 5000)
    }

    return () => {
      if (messageTimer.current) {
        clearTimeout(messageTimer.current)
        messageTimer.current = null
      }
    }
  }, [message])

  useEffect(() => {
    let cancelled = false

    async function loadFeedback() {
      try {
        const query = new URLSearchParams({ from: date, to: date })
        const response = await fetch(`/api/feedback?${query}`)
        if (!response.ok) {
          throw new Error(await readError(response, 'Could not load today’s feedback.'))
        }

        const result = await response.json()
        if (!Array.isArray(result.feedback)) {
          throw new Error('The server returned invalid daily feedback.')
        }
        const feedback = result.feedback.find((entry) => entry.feedback_date === date)
        if (!cancelled) setValues(toFormValues(feedback))
      } catch (loadError) {
        if (!cancelled) {
          setError(true)
          setMessage(loadError.message || 'Could not load today’s feedback.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFeedback()
    return () => {
      cancelled = true
    }
  }, [date])

  useEffect(() => {
    if (!editingEntry && !deleteTarget) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving && !deleting) {
        setEditingEntry(null)
        setDeleteTarget(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingEntry, deleteTarget, saving, deleting])

  function updateValue(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setMessage('')
    setError(false)
  }

  function updateEditValue(field, value) {
    setEditValues((current) => ({ ...current, [field]: value }))
  }

  async function loadHistory() {
    setHistoryLoading(true)
    setMessage('')
    setError(false)
    try {
      const response = await fetch('/api/feedback')
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not load feedback history.'))
      }

      const result = await response.json()
      if (!Array.isArray(result.feedback)) {
        throw new Error('The server returned an invalid feedback history.')
      }
      setHistory(result.feedback)
      setHistoryOpen(true)
    } catch (loadError) {
      setError(true)
      setMessage(loadError.message || 'Could not load feedback history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  async function saveFeedback(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError(false)

    try {
      const response = await fetch(`/api/feedback/${date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(values)),
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not save daily feedback.'))
      }

      const result = await response.json()
      if (!result.feedback || result.feedback.feedback_date !== date) {
        throw new Error('The server did not confirm today’s saved feedback.')
      }
      setValues(toFormValues(null))
      setHistory((current) => [
        result.feedback,
        ...current.filter((entry) => entry.feedback_date !== date),
      ].sort((first, second) => second.feedback_date.localeCompare(first.feedback_date)))
      setMessage('Daily feedback saved.')
    } catch (saveError) {
      setError(true)
      setMessage(saveError.message || 'Could not save daily feedback.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(entry) {
    setEditingEntry(entry)
    setEditValues(toFormValues(entry))
    setMessage('')
    setError(false)
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!editingEntry) return
    setSaving(true)
    setMessage('')
    setError(false)

    try {
      const response = await fetch(`/api/feedback/${editingEntry.feedback_date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(editValues)),
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not update feedback.'))
      }

      const result = await response.json()
      if (!result.feedback || result.feedback.feedback_date !== editingEntry.feedback_date) {
        throw new Error('The server did not confirm the updated feedback.')
      }
      setHistory((current) => current.map((entry) => (
        entry.feedback_date === result.feedback.feedback_date ? result.feedback : entry
      )))
      setEditingEntry(null)
      setMessage('Feedback updated.')
    } catch (saveError) {
      setError(true)
      setMessage(saveError.message || 'Could not update feedback.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteFeedback() {
    if (!deleteTarget) return
    setDeleting(true)
    setMessage('')
    setError(false)

    try {
      const response = await fetch(`/api/feedback/${deleteTarget.feedback_date}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not delete feedback.'))
      }

      setHistory((current) => current.filter(
        (entry) => entry.feedback_date !== deleteTarget.feedback_date,
      ))
      if (deleteTarget.feedback_date === date) setValues(toFormValues(null))
      setDeleteTarget(null)
      setMessage('Feedback deleted.')
    } catch (deleteError) {
      setError(true)
      setMessage(deleteError.message || 'Could not delete feedback.')
    } finally {
      setDeleting(false)
    }
  }

  const disabled = loading || saving

  return (
    <section className="daily-feedback" aria-labelledby="daily-feedback-title">
      <div className="daily-feedback-header">
        <div>
          <h2 id="daily-feedback-title">How do you feel today?</h2>
          <p>{formatDate(date)}</p>
        </div>
        <Button onClick={() => {
          if (historyOpen) setHistoryOpen(false)
          else loadHistory()
        }} disabled={historyLoading}>
          {historyLoading ? 'Loading…' : historyOpen ? 'Hide history' : 'View history'}
        </Button>
      </div>

      {loading && <p className="daily-feedback-message" role="status">Loading today’s feedback…</p>}

      <form className="daily-feedback-form" onSubmit={saveFeedback}>
        <FeedbackFields values={values} onChange={updateValue} disabled={disabled} />
        <div className="daily-feedback-actions">
          <Button type="submit" variant="accent" disabled={disabled}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>

      {historyOpen && (
        <div className="feedback-history" aria-labelledby="feedback-history-title">
          <h3 id="feedback-history-title">Feedback history</h3>
          {history.length === 0 ? (
            <p className="daily-feedback-message">No feedback logs yet.</p>
          ) : (
            <ul className="feedback-history-list">
              {history.map((entry) => (
                <li className="feedback-history-card" key={entry.feedback_date}>
                  <div className="feedback-history-card-header">
                    <h4>{formatDate(entry.feedback_date)}</h4>
                  </div>
                  <dl className="feedback-history-values">
                    <div><dt>Soreness</dt><dd>{entry.soreness ?? '—'}</dd></div>
                    <div><dt>Sleep</dt><dd>{entry.sleep_hours == null ? '—' : `${entry.sleep_hours} hours`}</dd></div>
                    <div><dt>Stress</dt><dd>{entry.stress ?? '—'}</dd></div>
                  </dl>
                  {entry.notes && <p className="feedback-history-notes">{entry.notes}</p>}
                  <div className="feedback-history-actions">
                    <Button
                      onClick={() => startEdit(entry)}
                      disabled={saving || deleting}
                      aria-label={`Edit feedback for ${formatDate(entry.feedback_date)}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setDeleteTarget(entry)}
                      disabled={saving || deleting}
                      aria-label={`Delete feedback for ${formatDate(entry.feedback_date)}`}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && (
        <p className={`daily-feedback-message${error ? ' daily-feedback-message--error' : ''}`}
          role={error ? 'alert' : 'status'}>
          {message}
        </p>
      )}

      {editingEntry && (
        <div
          className="feedback-modal-overlay"
          onClick={() => {
            if (!saving) setEditingEntry(null)
          }}
        >
          <section
            className="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-feedback-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="feedback-modal-header">
              <div>
                <h3 id="edit-feedback-title">Edit feedback</h3>
                <p>{formatDate(editingEntry.feedback_date)}</p>
              </div>
              <Button
                variant="icon"
                onClick={() => setEditingEntry(null)}
                disabled={saving}
                aria-label="Close edit feedback"
              >
                ✕
              </Button>
            </div>
            <form className="daily-feedback-form" onSubmit={saveEdit}>
              <FeedbackFields values={editValues} onChange={updateEditValue} disabled={saving} />
              <div className="daily-feedback-actions">
                <Button onClick={() => setEditingEntry(null)} disabled={saving}>Cancel</Button>
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving ? 'Saving…' : 'Update feedback'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div
          className="feedback-modal-overlay"
          onClick={() => {
            if (!deleting) setDeleteTarget(null)
          }}
        >
          <section
            className="feedback-modal feedback-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-feedback-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="feedback-modal-header">
              <h3 id="delete-feedback-title">Delete feedback?</h3>
              <Button
                variant="icon"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                aria-label="Close delete confirmation"
              >
                ✕
              </Button>
            </div>
            <p className="feedback-delete-message">
              Delete the feedback log for <strong>{formatDate(deleteTarget.feedback_date)}</strong>?
              This cannot be undone.
            </p>
            <div className="daily-feedback-actions">
              <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={deleteFeedback} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete feedback'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
