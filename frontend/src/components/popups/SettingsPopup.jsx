import PopupShell from './PopupShell'
import './SettingsPopup.css'

export default function SettingsPopup({ onClose }) {
  return (
    <PopupShell title="settings" onClose={onClose}>
      <p className="settings-placeholder">
        General settings will be available here.
      </p>
    </PopupShell>
  )
}
