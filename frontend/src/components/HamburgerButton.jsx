// src/components/HamburgerButton.jsx
import './HamburgerButton.css'

export default function HamburgerButton({ onClick, hidden }) {
  if (hidden) return null

  return (
    <button className="hamburger-btn" onClick={onClick} aria-label="Open menu">
      <span className="hamburger-line" />
      <span className="hamburger-line" />
      <span className="hamburger-line" />
    </button>
  )
}