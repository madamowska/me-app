// src/components/SettingsPopup.jsx
import PopupShell from './PopupShell'

export default function SettingsPopup({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <PopupShell title="settings" onClose={onClose}>
      <div className="field">

      </div>
    </PopupShell>
  )
}