// src/components/PopupShell.jsx
import Button from '../ui/Button'
import './Popup.css'

export default function PopupShell({ title, onClose, children, actions }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={e => e.stopPropagation()}>

        <span className="popup-close">
          <Button variant="icon" onClick={onClose}>✕</Button>
        </span>

        <h2>{title}</h2>

        <div className="popup-body">
          {children}
        </div>

        {actions && (
          <div className="popup-actions">
            {actions}
          </div>
        )}

      </div>
    </div>
  )
}
