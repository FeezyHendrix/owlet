import type { ChatRequest } from './llm/types'

export const STREAM_PORT = 'contextext.stream.v1'

export type StreamRequest = {
  type: 'start'
  providerId: string
  request: ChatRequest
}

export type StreamEvent =
  | { type: 'text'; value: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export type StreamControl = { type: 'abort' }
