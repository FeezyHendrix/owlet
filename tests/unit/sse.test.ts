import { describe, expect, it } from 'vitest'
import { parseSse } from '../../src/background/llm/sse'

function streamFromString(s: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(s))
      controller.close()
    },
  })
}

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[i] ?? ''))
      i++
    },
  })
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of it) out.push(x)
  return out
}

describe('parseSse', () => {
  it('parses a single data event', async () => {
    const body = streamFromString('data: hello\n\n')
    const events = await collect(parseSse(body, new AbortController().signal))
    expect(events).toEqual([{ event: undefined, data: 'hello' }])
  })

  it('parses named events with multiline data', async () => {
    const body = streamFromString(
      'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"hi"}}\n\n',
    )
    const events = await collect(parseSse(body, new AbortController().signal))
    expect(events).toHaveLength(1)
    expect(events[0]?.event).toBe('content_block_delta')
    expect(events[0]?.data).toContain('text_delta')
  })

  it('handles events split across chunks', async () => {
    const body = streamFromChunks(['data: foo', '\n', '\ndata: bar\n\n'])
    const events = await collect(parseSse(body, new AbortController().signal))
    expect(events.map((e) => e.data)).toEqual(['foo', 'bar'])
  })

  it('ignores comment lines and blank events', async () => {
    const body = streamFromString(': heartbeat\n\ndata: real\n\n')
    const events = await collect(parseSse(body, new AbortController().signal))
    expect(events).toEqual([{ event: undefined, data: 'real' }])
  })

  it('aborts cleanly when signal fires', async () => {
    const ac = new AbortController()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: first\n\n'))
      },
    })
    const it = parseSse(body, ac.signal)[Symbol.asyncIterator]()
    const first = await it.next()
    expect(first.value?.data).toBe('first')
    ac.abort()
    const next = await it.next()
    expect(next.done).toBe(true)
  })
})
