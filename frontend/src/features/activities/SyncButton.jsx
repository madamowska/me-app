// src/features/activities/SyncButton.jsx
import { useState } from 'react'
import Button from '../../components/ui/Button'
import { triggerSync } from './api'

const STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
}

export default function SyncButton() {
  const [status, setStatus] = useState(STATUS.IDLE)
  const [message, setMessage] = useState('')

  async function handleSync() {
    setStatus(STATUS.SYNCING)
    setMessage('')

    try {
      const result = await triggerSync()
      setStatus(STATUS.SUCCESS)
      setMessage(
        result.upserted > 0
          ? `Synced ${result.upserted} new activit${result.upserted === 1 ? 'y' : 'ies'}.`
          : 'Already up to date.'
      )
    } catch (err) {
      setStatus(STATUS.ERROR)
      setMessage(err.message || 'Sync failed.')
    }
  }

  return (
    <div className="sync-button-wrap">
      <Button
        variant="accent"
        onClick={handleSync}
        disabled={status === STATUS.SYNCING}
      >
        {status === STATUS.SYNCING ? 'Syncing…' : 'Sync Activities'}
      </Button>

      {message && (
        <p className={`sync-message sync-message--${status}`}>
          {message}
        </p>
      )}
    </div>
  )
}