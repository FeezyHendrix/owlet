import type { ProviderKind } from '@shared/schema'

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ChatRequest = {
  model: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
}

export type ProviderConfig = {
  kind: ProviderKind
  baseUrl: string
  apiKey: string
}

export type StreamChunk = { type: 'text'; value: string } | { type: 'done' }

export interface LLMAdapter {
  stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk>
  testConnection(
    signal: AbortSignal,
  ): Promise<{ ok: true; models?: string[] } | { ok: false; error: string }>
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'LLMError'
  }
}
