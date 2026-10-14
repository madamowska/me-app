import { useEffect, useRef } from 'react'
import { sanitizeRichHtml } from './richText'

const BLOCK_TAGS = new Set(['DIV', 'P'])

function getCurrentBlock(editor, selection) {
  let block = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode?.parentElement

  while (block && block !== editor && !BLOCK_TAGS.has(block.tagName) && block.tagName !== 'LI') {
    block = block.parentElement
  }
  return block || editor
}

function startMarkdownList(editor) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.startContainer)) return false

  const block = getCurrentBlock(editor, selection)
  const text = block.textContent || ''
  const beforeCaret = range.cloneRange()
  beforeCaret.selectNodeContents(block)
  beforeCaret.setEnd(range.endContainer, range.endOffset)
  if (beforeCaret.toString() !== text) return false

  const unordered = /^[ \t]*[-*+]\s$/.test(text)
  const ordered = /^[ \t]*\d+[.)]\s$/.test(text)
  if (!unordered && !ordered) return false

  const list = document.createElement(unordered ? 'ul' : 'ol')
  const item = document.createElement('li')
  item.append(document.createElement('br'))
  list.append(item)
  if (block === editor) editor.replaceChildren(list)
  else block.replaceWith(list)

  const caret = document.createRange()
  caret.setStart(item, 0)
  caret.collapse(true)
  selection.removeAllRanges()
  selection.addRange(caret)
  return true
}

export default function RichTextarea({
  value,
  onChange,
  className = '',
  maxLength,
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const safeHtml = sanitizeRichHtml(value)
    if (ref.current.innerHTML !== safeHtml) ref.current.innerHTML = safeHtml
  }, [value])

  function handleInput() {
    const editor = ref.current
    if (!editor) return

    const converted = startMarkdownList(editor)
    const safeHtml = sanitizeRichHtml(editor.innerHTML)
    if (editor.innerHTML !== safeHtml) editor.innerHTML = safeHtml
    if (maxLength && editor.textContent.length > maxLength) {
      editor.innerHTML = sanitizeRichHtml(value)
      return
    }
    onChange(editor.innerHTML)

    if (converted) editor.focus()
  }

  function runCommand(command) {
    ref.current?.focus()
    document.execCommand(command)
    handleInput()
  }

  function handleKeyDown(event) {
    const modifier = navigator.platform.toUpperCase().includes('MAC')
      ? event.metaKey
      : event.ctrlKey
    if (!modifier || event.shiftKey) return

    const commands = { b: 'bold', i: 'italic' }
    const command = commands[event.key.toLowerCase()]
    if (!command) return
    event.preventDefault()
    runCommand(command)
  }

  return (
    <div className="rich-editor">
      <div
        ref={ref}
        className={`rich-textarea ${className}`.trim()}
        contentEditable
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
    </div>
  )
}
