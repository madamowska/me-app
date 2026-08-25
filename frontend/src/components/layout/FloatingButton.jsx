// src/components/FloatingButton.jsx
import { forwardRef } from 'react'
import Button from '../ui/Button'

const style = {
  position:       'fixed',
  bottom:         '30px',
  left:           '50%',
  transform:      'translateX(-50%)',
  zIndex:         9999,
  isolation:      'isolate',
  backdropFilter: 'blur(6px)',
  boxShadow:      'var(--glow-white-sm)',
}

const hoverStyle = {
  boxShadow: 'var(--glow-white-md)',
}

const FloatingButton = forwardRef(function FloatingButton({ onClick, children = 'Open' }, ref) {
  return (
    <Button
      ref={ref}
      onClick={onClick}
      style={style}
      onMouseEnter={e => Object.assign(e.currentTarget.style, hoverStyle)}
      onMouseLeave={e => Object.assign(e.currentTarget.style, style)}
    >
      {children}
    </Button>
  )
})

export default FloatingButton