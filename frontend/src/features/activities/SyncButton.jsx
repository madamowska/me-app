// src/features/activities/SyncButton.jsx
import { useState } from 'react'
import Button from '../../components/ui/Button'
import useTransientMessage from '../../hooks/useTransientMessage'
import { triggerSync } from './api'

const STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
}

export default function SyncButton({ onSuccess }) {
  const [status, setStatus] = useState(STATUS.IDLE)
  const [message, setMessage, showTransientMessage] = useTransientMessage()

  async function handleSync() {
    setStatus(STATUS.SYNCING)
    setMessage('')

    try {
      const result = await triggerSync()
      setStatus(STATUS.SUCCESS)
      showTransientMessage(
        result.upserted > 0
          ? `Synced ${result.upserted} new activit${result.upserted === 1 ? 'y' : 'ies'}.`
          : 'Already up to date.'
      )

      if (typeof onSuccess === 'function') onSuccess(result)
    } catch (err) {
      setStatus(STATUS.ERROR)
      showTransientMessage(err.message || 'Sync failed.')
    }
  }

  const wrapperStyle = { position: 'relative', display: 'inline-block' }
  const transientStyle = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    top: 'calc(100% + 8px)',
    margin: 0,
  }

  const messageStyle = status === STATUS.SUCCESS
    ? { ...transientStyle, whiteSpace: 'nowrap' }
    : { whiteSpace: 'nowrap' }

  return (
    <div className="sync-button-wrap" style={wrapperStyle}>
      <Button
        variant="accent"
        onClick={handleSync}
        disabled={status === STATUS.SYNCING}
      >
        {status === STATUS.SYNCING ? 'Syncing…' : 'Sync Activities'}
      </Button>

      {message && (
        <p
          className={`sync-message sync-message--${status}`}
          style={messageStyle}
        >
          {message}
        </p>
      )}
    </div>
  )
}