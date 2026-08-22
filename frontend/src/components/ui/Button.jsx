// src/components/ui/Button.jsx
// Usage:
//   <Button>Open</Button>
//   <Button variant="accent" full>Save</Button>
//   <Button variant="icon" onClick={onClose}>✕</Button>

export default function Button({ children, variant, full, onClick, type = 'button', ...props }) {
  const classes = [
    'btn',
    variant ? `btn--${variant}` : '',
    full     ? 'btn--full'      : '',
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} type={type} onClick={onClick} {...props}>
      {children}
    </button>
  )
}
