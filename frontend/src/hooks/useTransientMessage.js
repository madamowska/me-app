import { useCallback, useEffect, useState } from 'react'

const MESSAGE_DURATION = 5000

export default function useTransientMessage() {
  const [messageState, setMessageState] = useState({ text: '', transient: false })

  useEffect(() => {
    if (!messageState.transient || !messageState.text) return undefined

    const timer = window.setTimeout(() => {
      setMessageState({ text: '', transient: false })
    }, MESSAGE_DURATION)

    return () => window.clearTimeout(timer)
  }, [messageState])

  const setMessage = useCallback((text) => {
    setMessageState({ text, transient: false })
  }, [])

  const showTransientMessage = useCallback((text) => {
    setMessageState({ text, transient: true })
  }, [])

  return [messageState.text, setMessage, showTransientMessage]
}
