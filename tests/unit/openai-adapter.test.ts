import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenAIAdapter } from '../../src/background/llm/openai'

function sseResponse(events: string[]): Response {
  const body = `${events.join('')}data: [DONE]\n\n`
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body))
        controller.close()
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )
}

const adapter = createOpenAIAdapter({
  kind: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OpenAI adapter', () => {
  it('streams text deltas and emits done', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
        ]),
      ),
    )

    const chunks: string[] = []
    let done = false
    for await (const c of adapter.stream(
      { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] },
      new AbortController().signal,
    )) {
      if (c.type === 'text') chunks.push(c.value)
      if (c.type === 'done') done = true
    }
    expect(chunks.join('')).toBe('Hello!')
    expect(done).toBe(true)
  })

  it('throws a friendly error on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'Bad key' } }), { status: 401 }),
      ),
    )
    const it = adapter
      .stream(
        { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] },
        new AbortController().signal,
      )
      [Symbol.asyncIterator]()
    await expect(it.next()).rejects.toThrow(/Invalid API key.*Bad key/)
  })

  it('treats 429 on /models as a successful test connection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate limited', { status: 429 })),
    )
    const result = await adapter.testConnection(new AbortController().signal)
    expect(result.ok).toBe(true)
  })

  it('returns model list on successful test connection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] }), {
            status: 200,
          }),
      ),
    )
    const result = await adapter.testConnection(new AbortController().signal)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.models).toEqual(['gpt-4o-mini', 'gpt-4o'])
  })
})
