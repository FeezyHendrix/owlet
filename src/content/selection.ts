export type CapturedSelection = {
  text: string
  range: Range
  rect: DOMRect
  paragraph: string
  pageTitle: string
  pageUrl: string
}

const MIN_CHARS = 3
const MAX_CHARS = 20_000

export function captureSelection(): CapturedSelection | null {
  const selection = readActiveSelection()
  if (!selection) return null

  const { text, range } = selection
  const trimmed = text.trim()
  if (trimmed.length < MIN_CHARS) return null

  const rect = range.getBoundingClientRect()

  const truncated = trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS) : trimmed

  return {
    text: truncated,
    range: range.cloneRange(),
    rect,
    paragraph: extractParagraph(range),
    pageTitle: document.title,
    pageUrl: location.href,
  }
}

function readActiveSelection(): { text: string; range: Range } | null {
  const active = document.activeElement
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    const start = active.selectionStart
    const end = active.selectionEnd
    if (start == null || end == null || start === end) return null
    const text = active.value.slice(start, end)
    const range = document.createRange()
    range.selectNode(active)
    return { text, range }
  }

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null

  const parts: string[] = []
  let firstRange: Range | null = null
  for (let i = 0; i < sel.rangeCount; i++) {
    const r = sel.getRangeAt(i)
    if (!firstRange) firstRange = r
    parts.push(r.toString())
  }
  const text = parts.join('\n')
  if (!firstRange || !text) return null
  return { text, range: firstRange }
}

function extractParagraph(range: Range): string {
  let node: Node | null = range.commonAncestorContainer
  while (node && node.nodeType !== Node.ELEMENT_NODE) {
    node = node.parentNode
  }
  while (node && node instanceof Element) {
    if (isBlockLike(node)) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      return text.slice(0, 4000)
    }
    node = node.parentElement
  }
  return ''
}

const BLOCK_TAGS = new Set([
  'P',
  'LI',
  'BLOCKQUOTE',
  'ARTICLE',
  'SECTION',
  'DIV',
  'TD',
  'PRE',
  'FIGCAPTION',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
])

function isBlockLike(el: Element): boolean {
  if (BLOCK_TAGS.has(el.tagName)) return true
  const display = window.getComputedStyle(el).display
  return display === 'block' || display === 'list-item' || display.startsWith('flex')
}
