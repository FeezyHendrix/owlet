import { parseSse } from './sse'
import {
  type ChatRequest,
  type LLMAdapter,
  LLMError,
  type ProviderConfig,
  type StreamChunk,
} from './types'

export function createOpenAIAdapter(config: ProviderConfig): LLMAdapter {
  return {
    async *stream(req: ChatRequest, signal: AbortSignal): AsyncGenerator<StreamChunk> {
      const url = joinUrl(config.baseUrl, '/chat/completions')
      const res = await fetch(url, {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true,
          ...(req.maxTokens != null ? { max_tokens: req.maxTokens } : {}),
          ...(req.temperature != null ? { temperature: req.temperature } : {}),
        }),
      })

      if (!res.ok || !res.body) {
        throw await readError(res)
      }

      for await (const evt of parseSse(res.body, signal)) {
        if (evt.data === '[DONE]') {
          yield { type: 'done' }
          return
        }
        const text = extractDelta(evt.data)
        if (text) yield { type: 'text', value: text }
      }
      yield { type: 'done' }
    },

    async testConnection(signal) {
      try {
        const res = await fetch(joinUrl(config.baseUrl, '/models'), {
          signal,
          headers: { authorization: `Bearer ${config.apiKey}` },
        })
        if (res.status === 429) return { ok: true }
        if (!res.ok) {
          const err = await readError(res)
          return { ok: false, error: err.message }
        }
        const json = (await res.json()) as { data?: Array<{ id: string }> }
        return { ok: true, models: json.data?.map((m) => m.id) }
      } catch (err) {
        return { ok: false, error: errorMessage(err) }
      }
    },

    async listModels(signal) {
      const res = await fetch(joinUrl(config.baseUrl, '/models'), {
        signal,
        headers: { authorization: `Bearer ${config.apiKey}` },
      })
      if (!res.ok) throw await readError(res)
      const json = (await res.json()) as { data?: Array<{ id: string }> }
      return (json.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string')
    },
  }
}

function extractDelta(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as {
      choices?: Array<{ delta?: { content?: string } }>
    }
    return parsed.choices?.[0]?.delta?.content ?? null
  } catch {
    return null
  }
}

async function readError(res: Response): Promise<LLMError> {
  let detail = ''
  try {
    const body = await res.text()
    try {
      const json = JSON.parse(body) as { error?: { message?: string; code?: string } }
      detail = json.error?.message ?? body
      return new LLMError(formatError(res.status, detail), res.status, json.error?.code)
    } catch {
      detail = body.slice(0, 300)
    }
  } catch {
    // body unreadable
  }
  return new LLMError(formatError(res.status, detail), res.status)
}

function formatError(status: number, detail: string): string {
  switch (status) {
    case 401:
      return `Invalid API key (401). ${detail}`.trim()
    case 403:
      return `Forbidden (403). ${detail}`.trim()
    case 404:
      return `Model or endpoint not found (404). ${detail}`.trim()
    case 429:
      return `Rate limited (429). ${detail}`.trim()
    case 500:
    case 502:
    case 503:
    case 504:
      return `Provider error (${status}). ${detail}`.trim()
    default:
      return detail || `Request failed with status ${status}`
  }
}

function joinUrl(base: string, path: string): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${trimmed}${suffix}`
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
