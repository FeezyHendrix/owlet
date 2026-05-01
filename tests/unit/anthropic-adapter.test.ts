import { describe, expect, it, vi } from 'vitest'
import { createAnthropicAdapter } from '../../src/background/llm/anthropic'

const adapter = createAnthropicAdapter({
  kind: 'anthropic',
  baseUrl: 'https://api.anthropic.com/v1',
  apiKey: 'sk-ant-test',
})

describe('Anthropic adapter listModels', () => {
  it('returns model ids from GET /v1/models', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              { id: 'claude-opus-4-5' },
              { id: 'claude-sonnet-4-5' },
              { id: 'claude-haiku-4-5' },
            ],
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const models = await adapter.listModels(new AbortController().signal)
    expect(models).toEqual(['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'])
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/models')
    expect(init.headers).toMatchObject({
      'x-api-key': 'sk-ant-test',
      'anthropic-version': '2023-06-01',
    })
  })

  it('throws friendly error on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'invalid key' } }), { status: 401 }),
      ),
    )
    await expect(adapter.listModels(new AbortController().signal)).rejects.toThrow(
      /Invalid API key.*invalid key/,
    )
  })
})
