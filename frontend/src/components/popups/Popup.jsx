// src/components/Popup.jsx
import { useState } from 'react'
import Button from '../ui/Button'
import './Popup.css'

/* ── Creation Popup ── */
export function CreatePopup({ isOpen, onClose, onSave }) {
  const [name, setName]        = useState('')

  if (!isOpen) return null

  function handleAddElement() {
    if (!name.trim()) return
    onSave({ name: name.trim()})
    setName('')
    onClose()
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={e => e.stopPropagation()}>

        <span className="popup-close">
          <Button variant="icon" onClick={onClose}>✕</Button>
        </span>

        <h2>new element</h2>

        <div className="field">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <Button variant="accent" full onClick={handleAddElement}>
          Add Element
        </Button>

      </div>
    </div>
  )
}