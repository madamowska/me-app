// src/components/Sidebar.jsx
import { useEffect } from 'react'
import './Sidebar.css'

export default function Sidebar({ isOpen, onClose, onSettingsClick }) {
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
              onSettingsClick()
              onClose()
            }}
          >
            <span className="sidebar-nav-icon">⚙</span>
            settings
          </button>
        </nav>
      </aside>
    </>
  )
}