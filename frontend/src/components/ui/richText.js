const ALLOWED_TAGS = new Set([
  'B', 'BR', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'S', 'SPAN', 'STRONG', 'U', 'UL',
])
const MARKUP_TAG_PATTERN = /<\/?(?:b|br|div|em|i|li|ol|p|s|span|strong|u|ul)\b/i

function copySafeNode(source, target) {
  if (source.nodeType === Node.TEXT_NODE) {
    target.append(document.createTextNode(source.textContent || ''))
    return
  }
  if (source.nodeType !== Node.ELEMENT_NODE) return

  const element = source
  if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return
  if (!ALLOWED_TAGS.has(element.tagName)) {
    element.childNodes.forEach((child) => copySafeNode(child, target))
    return
  }

  const safeElement = document.createElement(element.tagName.toLowerCase())
  if (element.tagName === 'SPAN' && element.classList.contains('rich-accent')) {
    safeElement.className = 'rich-accent'
  }
  element.childNodes.forEach((child) => copySafeNode(child, safeElement))
  target.append(safeElement)
}

export function sanitizeRichHtml(value) {
  const input = Array.isArray(value) ? value.join('\n') : typeof value === 'string' ? value : ''
  if (!input.trim()) return ''
  if (!MARKUP_TAG_PATTERN.test(input)) {
    const text = document.createElement('div')
    text.textContent = input
    return text.innerHTML.replace(/\r?\n/g, '<br>')
  }

  const parsed = new DOMParser().parseFromString(input, 'text/html')
  if (!parsed.body.textContent?.trim() && !parsed.body.querySelector('ul, ol')) return ''
  const safe = document.createElement('div')
  parsed.body.childNodes.forEach((child) => copySafeNode(child, safe))
  return safe.innerHTML
}
