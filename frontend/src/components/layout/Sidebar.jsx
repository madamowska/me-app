// src/components/Sidebar.jsx
import { useEffect } from 'react'
import './Sidebar.css'

export default function Sidebar({
  isOpen,
  onClose,
  onSettingsClick,
  onAthleteProfileClick,
  onInjuryHistoryClick,
  onHomeClick,
}) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKey)
    }

    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className="sidebar-nav-item"
            onClick={() => {
              onHomeClick()
              onClose()
            }}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m3 10 9-7 9 7" />
                <path d="M5 9v12h14V9" />
              </svg>
            </span>
            <span>home</span>
          </button>
          <button
            className="sidebar-nav-item"
            onClick={() => {
              onAthleteProfileClick()
              onClose()
            }}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </span>
            <span>athlete profile</span>
          </button>
          <button
            className="sidebar-nav-item"
            onClick={() => {
              onInjuryHistoryClick()
              onClose()
            }}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3.5 20 7v5.5c0 4.2-3.4 7.2-8 8.9-4.6-1.7-8-4.7-8-8.9V7l8-3.5Z" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </span>
            <span>injury history</span>
          </button>
          <button
            className="sidebar-nav-item sidebar-nav-item--bottom"
            onClick={() => {
              onSettingsClick()
              onClose()
            }}
          >
            <span className="sidebar-nav-icon">⚙</span>
            <span>settings</span>
          </button>
        </nav>
      </aside>
    </>
  )
}