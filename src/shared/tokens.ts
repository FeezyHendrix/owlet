const CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export function charBudgetForTokens(tokens: number): number {
  return Math.max(0, tokens) * CHARS_PER_TOKEN
}

export type TrimResult = {
  text: string
  trimmed: boolean
  originalChars: number
  finalChars: number
}

export function trimToCharBudget(
  text: string,
  maxChars: number,
  marker = '\n\n…[trimmed]…',
): TrimResult {
  const originalChars = text.length
  if (originalChars <= maxChars) {
    return { text, trimmed: false, originalChars, finalChars: originalChars }
  }
  const head = Math.floor((maxChars - marker.length) * 0.6)
  const tail = Math.max(0, maxChars - marker.length - head)
  if (head <= 0 || tail <= 0) {
    const safe = text.slice(0, Math.max(0, maxChars))
    return { text: safe, trimmed: true, originalChars, finalChars: safe.length }
  }
  const trimmed = `${text.slice(0, head)}${marker}${text.slice(text.length - tail)}`
  return { text: trimmed, trimmed: true, originalChars, finalChars: trimmed.length }
}
