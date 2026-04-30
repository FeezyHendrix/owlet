export type PageExtraction = {
  text: string
  title: string
  byline?: string
  source: 'readability' | 'fallback'
}

const FALLBACK_MAX_CHARS = 50_000

export async function extractPageContent(): Promise<PageExtraction> {
  const readability = await tryReadability()
  if (readability) return readability
  return fallbackExtract()
}

async function tryReadability(): Promise<PageExtraction | null> {
  try {
    const { Readability, isProbablyReaderable } = await import('@mozilla/readability')
    if (!isProbablyReaderable(document)) return null
    const cloned = document.cloneNode(true) as Document
    const article = new Readability(cloned).parse()
    if (!article?.textContent) return null
    const text = normalizeWhitespace(article.textContent)
    if (text.length < 200) return null
    return {
      text,
      title: article.title || document.title,
      ...(article.byline ? { byline: article.byline } : {}),
      source: 'readability',
    }
  } catch {
    return null
  }
}

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'NAV',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'IFRAME',
  'SVG',
  'CANVAS',
])

function fallbackExtract(): PageExtraction {
  const root = document.body
  const parts: string[] = []

  const main = document.querySelector('main, article, [role="main"]')
  const target = main ?? root

  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      const text = node.nodeValue
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let total = 0
  let n: Node | null = walker.nextNode()
  while (n) {
    const value = (n.nodeValue ?? '').trim()
    if (value) {
      parts.push(value)
      total += value.length + 1
      if (total > FALLBACK_MAX_CHARS) break
    }
    n = walker.nextNode()
  }

  return {
    text: normalizeWhitespace(parts.join(' ')),
    title: document.title,
    source: 'fallback',
  }
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
