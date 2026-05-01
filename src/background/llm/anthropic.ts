import { parseSse } from './sse'
import {
  type ChatMessage,
  type ChatRequest,
  type LLMAdapter,
  LLMError,
  type ProviderConfig,
  type StreamChunk,
} from './types'

const ANTHROPIC_VERSION = '2023-06-01'

export function createAnthropicAdapter(config: ProviderConfig): LLMAdapter {
  return {
    async *stream(req: ChatRequest, signal: AbortSignal): AsyncGenerator<StreamChunk> {
      const url = joinUrl(config.baseUrl, '/messages')
      const { system, messages } = splitSystem(req.messages)

      const res = await fetch(url, {
        method: 'POST',
        signal,
        headers: anthropicHeaders(config.apiKey),
        body: JSON.stringify({
          model: req.model,
          stream: true,
          max_tokens: req.maxTokens ?? 1024,
          ...(req.temperature != null ? { temperature: req.temperature } : {}),
          ...(system ? { system } : {}),
          messages,
        }),
      })

      if (!res.ok || !res.body) {
        throw await readError(res)
      }

      for await (const evt of parseSse(res.body, signal)) {
        if (evt.event === 'message_stop') {
          yield { type: 'done' }
          return
        }
        if (evt.event === 'content_block_delta') {
          const text = extractDelta(evt.data)
          if (text) yield { type: 'text', value: text }
        }
      }
      yield { type: 'done' }
    },

    async testConnection(signal) {
      try {
        const res = await fetch(joinUrl(config.baseUrl, '/messages'), {
          method: 'POST',
          signal,
          headers: anthropicHeaders(config.apiKey),
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        })
        if (res.status === 429) return { ok: true }
        if (res.status === 404 || res.ok) return { ok: true }
        const err = await readError(res)
        return { ok: false, error: err.message }
      } catch (err) {
        return { ok: false, error: errorMessage(err) }
      }
    },

    async listModels(signal) {
      const res = await fetch(joinUrl(config.baseUrl, '/models'), {
        signal,
        headers: anthropicHeaders(config.apiKey),
      })
      if (!res.ok) throw await readError(res)
      const json = (await res.json()) as { data?: Array<{ id: string }> }
      return (json.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string')
    },
  }
}

function anthropicHeaders(apiKey: string): HeadersInit {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function splitSystem(messages: ChatMessage[]): { system?: string; messages: ChatMessage[] } {
  const systems = messages.filter((m) => m.role === 'system').map((m) => m.content)
  const rest = messages.filter((m) => m.role !== 'system')
  return systems.length ? { system: systems.join('\n\n'), messages: rest } : { messages: rest }
}

function extractDelta(json: string): string | null {
  try {
    const parsed = JSON.parse(json) as { delta?: { type?: string; text?: string } }
    if (parsed.delta?.type === 'text_delta') return parsed.delta.text ?? null
    return null
  } catch {
    return null
  }
}

async function readError(res: Response): Promise<LLMError> {
  let detail = ''
  try {
    const body = await res.text()
    try {
      const json = JSON.parse(body) as { error?: { message?: string; type?: string } }
      detail = json.error?.message ?? body
      return new LLMError(formatError(res.status, detail), res.status, json.error?.type)
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
