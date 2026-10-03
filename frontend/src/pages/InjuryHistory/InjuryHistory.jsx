import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import './InjuryHistory.css'

const EMPTY_INJURY = {
  injury_name: '',
  started_on: '',
  resolved_on: '',
  details: '',
  ongoing: true,
}

function toInjuryDraft(injury) {
  return {
    injury_name: injury.injury_name ?? '',
    started_on: injury.started_on ?? '',
    resolved_on: injury.resolved_on ?? '',
    details: injury.details ?? '',
    ongoing: !injury.resolved_on,
  }
}

async function readError(response, fallback) {
  const body = await response.json().catch(() => ({}))
  return body.error || fallback
}

function formatDate(date) {
  if (!date) return 'Not set'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function InjuryForm({
  draft,
  onDraftChange,
  onOngoingChange,
  onSubmit,
  submitLabel,
  saving,
  onCancel,
}) {
  return (
    <form className="injury-form" onSubmit={onSubmit}>
      <label className="injury-field">
        <span>Injury</span>
        <input
          type="text"
          maxLength={150}
          required
          value={draft.injury_name}
          onChange={(event) => onDraftChange('injury_name', event.target.value)}
        />
      </label>
      <div className="injury-date-row">
        <label className="injury-field">
          <span>Started on</span>
          <input
            type="date"
            value={draft.started_on}
            onChange={(event) => onDraftChange('started_on', event.target.value)}
          />
        </label>
        <label className="injury-field">
          <span>Resolved on</span>
          <input
            type="date"
            min={draft.started_on || undefined}
            required={!draft.ongoing}
            disabled={draft.ongoing}
            value={draft.resolved_on}
            onChange={(event) => onDraftChange('resolved_on', event.target.value)}
          />
        </label>
      </div>
      <label className="injury-ongoing-toggle">
        <input
          type="checkbox"
          checked={draft.ongoing}
          onChange={(event) => onOngoingChange(event.target.checked)}
        />
        <span>Ongoing injury (no resolved date)</span>
      </label>
      <label className="injury-field">
        <span>Details <span className="injury-optional">(optional)</span></span>
        <textarea
          rows={4}
          maxLength={3000}
          value={draft.details}
          onChange={(event) => onDraftChange('details', event.target.value)}
        />
      </label>
      <div className="injury-form-actions">
        {onCancel && (
          <Button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="accent" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default function InjuryHistory() {
  const [injuries, setInjuries] = useState([])
  const [draft, setDraft] = useState(EMPTY_INJURY)
  const [editingInjuryId, setEditingInjuryId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadInjuries() {
      try {
        const response = await fetch('/api/injuries')
        if (!response.ok) {
          throw new Error(await readError(response, 'Could not load injury history.'))
        }

        const result = await response.json()
        if (!Array.isArray(result.injuries)) {
          throw new Error('The server returned an invalid injury history.')
        }
        if (!cancelled) setInjuries(result.injuries)
      } catch (loadError) {
        if (!cancelled) {
          setError(true)
          setMessage(loadError.message || 'Could not load injury history.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInjuries()
    return () => {
      cancelled = true
    }
  }, [])

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function setOngoing(ongoing) {
    setDraft((current) => ({
      ...current,
      ongoing,
      resolved_on: ongoing ? '' : current.resolved_on,
    }))
  }

  function cancelEdit() {
    setEditingInjuryId(null)
    setDraft(EMPTY_INJURY)
    setMessage('')
    setError(false)
  }

  function startEdit(injury) {
    setEditingInjuryId(injury.id)
    setDraft(toInjuryDraft(injury))
    setMessage('')
    setError(false)
  }

  async function saveInjury(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError(false)

    const payload = {
      injury_name: draft.injury_name.trim(),
      started_on: draft.started_on || null,
      resolved_on: draft.ongoing ? null : draft.resolved_on,
      details: draft.details.trim() || null,
    }

    try {
      const response = await fetch(
        editingInjuryId ? `/api/injuries/${editingInjuryId}` : '/api/injuries',
        {
        method: editingInjuryId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        },
      )
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not save injury.'))
      }

      const result = await response.json()
      if (!result.injury || typeof result.injury !== 'object') {
        throw new Error('The server did not confirm the saved injury.')
      }
      setInjuries((current) => [
        result.injury,
        ...current.filter((injury) => injury.id !== result.injury.id),
      ].sort((first, second) => (second.started_on || '').localeCompare(first.started_on || '')))
      setDraft(EMPTY_INJURY)
      setEditingInjuryId(null)
      setMessage(editingInjuryId ? 'Injury updated.' : 'Injury saved.')
    } catch (saveError) {
      setError(true)
      setMessage(saveError.message || 'Could not save injury.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteInjury() {
    if (!deleteTarget) return
    setDeleting(true)
    setMessage('')
    setError(false)

    try {
      const response = await fetch(`/api/injuries/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not delete injury.'))
      }

      setInjuries((current) => current.filter((injury) => injury.id !== deleteTarget.id))
      setMessage('Injury deleted.')
      setDeleteTarget(null)
    } catch (deleteError) {
      setError(true)
      setMessage(deleteError.message || 'Could not delete injury.')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!editingInjuryId && !deleteTarget) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving && !deleting) {
        cancelEdit()
        setDeleteTarget(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingInjuryId, deleteTarget, saving, deleting])

  return (
    <main className="injury-history-page">
      <div className="injury-history-content">
        <header className="injury-history-header">
          <h1>Injury History</h1>
          <p>Record current and past injuries to keep your training plan informed.</p>
        </header>

        <section className="injury-history-section" aria-labelledby="add-injury-title">
          <h2 id="add-injury-title">Add an injury</h2>
          <InjuryForm
            draft={draft}
            onDraftChange={updateDraft}
            onOngoingChange={setOngoing}
            onSubmit={saveInjury}
            submitLabel="Save injury"
            saving={saving}
          />
        </section>

        <section className="injury-history-section" aria-labelledby="injury-list-title">
          <h2 id="injury-list-title">Recorded injuries</h2>
          {loading && <p className="injury-message" role="status">Loading injury history…</p>}
          {!loading && !injuries.length && (
            <p className="injury-message">No injuries recorded yet.</p>
          )}
          {!loading && injuries.length > 0 && (
            <ul className="injury-list">
              {injuries.map((injury) => (
                <li className="injury-card" key={injury.id}>
                  <div className="injury-card-header">
                    <h3>{injury.injury_name}</h3>
                    <span className={`injury-status${injury.resolved_on ? ' injury-status--resolved' : ''}`}>
                      {injury.resolved_on ? 'Resolved' : 'Ongoing'}
                    </span>
                  </div>
                  <p className="injury-dates">
                    {formatDate(injury.started_on)}
                    {' — '}
                    {injury.resolved_on ? formatDate(injury.resolved_on) : 'Ongoing'}
                  </p>
                  {injury.details && <p className="injury-details">{injury.details}</p>}
                  <div className="injury-card-actions">
                    <Button
                      onClick={() => startEdit(injury)}
                      disabled={saving || deleting}
                      aria-label={`Edit ${injury.injury_name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setDeleteTarget(injury)}
                      disabled={saving || deleting}
                      aria-label={`Delete ${injury.injury_name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {message && (
          <p className={`injury-message${error ? ' injury-message--error' : ''}`}
            role={error ? 'alert' : 'status'}>
            {message}
          </p>
        )}
      </div>
      {editingInjuryId && (
        <div
          className="injury-modal-overlay"
          onClick={() => {
            if (!saving) cancelEdit()
          }}
        >
          <section
            className="injury-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-injury-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="injury-modal-header">
              <h2 id="edit-injury-title">Edit injury</h2>
              <Button
                variant="icon"
                onClick={cancelEdit}
                disabled={saving}
                aria-label="Close edit injury"
              >
                ✕
              </Button>
            </div>
            <InjuryForm
              draft={draft}
              onDraftChange={updateDraft}
              onOngoingChange={setOngoing}
              onSubmit={saveInjury}
              submitLabel="Update injury"
              saving={saving}
              onCancel={cancelEdit}
            />
          </section>
        </div>
      )}
      {deleteTarget && (
        <div
          className="injury-modal-overlay"
          onClick={() => {
            if (!deleting) setDeleteTarget(null)
          }}
        >
          <section
            className="injury-modal injury-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-injury-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="injury-modal-header">
              <h2 id="delete-injury-title">Delete injury?</h2>
              <Button
                variant="icon"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                aria-label="Close delete confirmation"
              >
                ✕
              </Button>
            </div>
            <p className="injury-delete-message">
              Delete <strong>{deleteTarget.injury_name}</strong> from your injury history? This cannot be undone.
            </p>
            <div className="injury-form-actions">
              <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={deleteInjury} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete injury'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
