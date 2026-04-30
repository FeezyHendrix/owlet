export type SseEvent = {
  event?: string
  data: string
}

export async function* parseSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const onAbort = () => reader.cancel().catch(() => {})
  signal.addEventListener('abort', onAbort, { once: true })

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const evt = parseEventBlock(raw)
        if (evt) yield evt
        boundary = buffer.indexOf('\n\n')
      }
    }
    if (buffer.trim()) {
      const evt = parseEventBlock(buffer)
      if (evt) yield evt
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
    try {
      reader.releaseLock()
    } catch {
      // reader may already be cancelled
    }
  }
}

function parseEventBlock(block: string): SseEvent | null {
  let event: string | undefined
  const dataLines: string[] = []

  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}
