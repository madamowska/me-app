// src/components/RichTextarea.jsx
// A contenteditable div that supports:
//   Cmd+B        → bold
//   Cmd+I        → italic
//   Cmd+H  → accent color

import { useRef, useEffect } from 'react'

export default function RichTextarea({ value, onChange, placeholder }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || ''
    }
  }, [])

  function handleKeyDown(e) {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const mod   = isMac ? e.metaKey : e.ctrlKey

    if (mod && !e.shiftKey && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      document.execCommand('bold')
    }

    if (mod && !e.shiftKey && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      document.execCommand('italic')
    }

    if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault()
      applyAccentColor()
    }
  }

  function applyAccentColor() {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()
    if (!selectedText) return

    const parentEl = selection.anchorNode?.parentElement
    if (parentEl?.classList.contains('rich-accent')) {
      const text = document.createTextNode(parentEl.textContent)
      parentEl.replaceWith(text)
    } else {
      const span = document.createElement('span')
      span.className = 'rich-accent'
      range.surroundContents(span)
    }

    onChange(ref.current.innerHTML)
  }

  function handleInput() {
    onChange(ref.current.innerHTML)
  }

  return (
    <div
      ref={ref}
      className="rich-textarea"
      contentEditable
      suppressContentEditableWarning
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      data-placeholder={placeholder}
    />
  )
}
