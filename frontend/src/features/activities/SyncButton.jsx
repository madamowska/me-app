// src/features/activities/SyncButton.jsx
import { useState, useEffect, useRef } from 'react'
import Button from '../../components/ui/Button'
import { triggerSync } from './api'

const STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
}

export default function SyncButton({ onSuccess }) {
  const [status, setStatus] = useState(STATUS.IDLE)
  const [message, setMessage] = useState('')
  const transientTimer = useRef(null)

  // Auto-hide the "Already up to date." message after 5 seconds
  useEffect(() => {
    // Clear any existing timer when message changes
    if (transientTimer.current) {
      clearTimeout(transientTimer.current)
      transientTimer.current = null
    }

    if (message === 'Already up to date.') {
      transientTimer.current = setTimeout(() => {
        setMessage('')
        transientTimer.current = null
      }, 5000)
    }

    return () => {
      if (transientTimer.current) {
        clearTimeout(transientTimer.current)
        transientTimer.current = null
      }
    }
  }, [message])

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

      // notify parent that sync succeeded so it can refresh data
      if (typeof onSuccess === 'function') onSuccess(result)
    } catch (err) {
      setStatus(STATUS.ERROR)
      setMessage(err.message || 'Sync failed.')
    }
  }

  // Inline styles used to position the transient message centered under the button
  const wrapperStyle = { position: 'relative', display: 'inline-block' }
  const transientStyle = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    top: 'calc(100% + 8px)',
    margin: 0,
  }

  // Ensure the message never wraps; if it's the transient "Already up to date." message
  // merge the transient positioning with nowrap. Other messages keep nowrap as well.
  const messageStyle = message === 'Already up to date.'
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
        // If the message is the "Already up to date." transient text, center it under the button
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