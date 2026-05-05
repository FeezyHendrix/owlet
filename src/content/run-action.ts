import type { ChatMessage, ChatRequest } from '@/background/llm/types'
import { STREAM_PORT, type StreamEvent, type StreamRequest } from '@/background/stream-protocol'
import type { Action, Provider } from '@shared/schema'
import { type TemplateVars, renderTemplate } from '@shared/templates'
import { type TrimResult, trimToCharBudget } from '@shared/tokens'
import { extractPageContent } from './extract'
import type { CapturedSelection } from './selection'

const MAX_PROMPT_CHARS = 80_000

export type RunCallbacks = {
  onText: (delta: string) => void
  onDone: () => void
  onError: (message: string) => void
  onTrimmedNotice?: (notice: string) => void
  onPrompts?: (resolved: { systemPrompt: string; userPrompt: string }) => void
}

export type RunHandle = {
  abort: () => void
}

export async function runAction(
  selection: CapturedSelection,
  action: Action,
  provider: Provider,
  callbacks: RunCallbacks,
  options?: { question?: string },
): Promise<RunHandle> {
  let aborted = false
  let port: chrome.runtime.Port | null = null

  try {
    const vars = await buildVars(selection, action.contextScope)
    if (options?.question !== undefined) vars.question = options.question
    const userPrompt = renderTemplate(action.userPromptTemplate, vars)
    const trimResult = trimToCharBudget(userPrompt, MAX_PROMPT_CHARS)

    if (trimResult.trimmed && callbacks.onTrimmedNotice) {
      callbacks.onTrimmedNotice(
        `Context trimmed to fit budget (${trimResult.originalChars.toLocaleString()} → ${trimResult.finalChars.toLocaleString()} chars).`,
      )
    }

    if (callbacks.onPrompts) {
      callbacks.onPrompts({ systemPrompt: action.systemPrompt, userPrompt: trimResult.text })
    }

    if (aborted) return { abort: noop }

    const messages: ChatMessage[] = []
    if (action.systemPrompt.trim()) {
      messages.push({ role: 'system', content: action.systemPrompt })
    }
    messages.push({ role: 'user', content: trimResult.text })

    const request: ChatRequest = {
      model: action.model || provider.defaultModel,
      messages,
      ...(action.maxTokens !== undefined ? { maxTokens: action.maxTokens } : {}),
      ...(action.temperature !== undefined ? { temperature: action.temperature } : {}),
    }

    port = chrome.runtime.connect({ name: STREAM_PORT })

    port.onMessage.addListener((event: StreamEvent) => {
      if (aborted) return
      if (event.type === 'text') callbacks.onText(event.value)
      else if (event.type === 'done') callbacks.onDone()
      else if (event.type === 'error') callbacks.onError(event.message)
    })

    port.onDisconnect.addListener(() => {
      if (aborted) return
      const err = chrome.runtime.lastError?.message
      if (err) callbacks.onError(err)
    })

    const startMessage: StreamRequest = {
      type: 'start',
      providerId: provider.id,
      request,
    }
    port.postMessage(startMessage)
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : String(err))
  }

  return {
    abort: () => {
      aborted = true
      if (port) {
        try {
          port.postMessage({ type: 'abort' })
        } catch {
          // port already closed; nothing to do
        }
        try {
          port.disconnect()
        } catch {
          // already disconnected
        }
      }
    },
  }
}

async function buildVars(
  selection: CapturedSelection,
  scope: Action['contextScope'],
): Promise<TemplateVars> {
  const base: TemplateVars = {
    selection: selection.text,
    title: selection.pageTitle,
    url: selection.pageUrl,
  }

  if (scope === 'selection') {
    return base
  }

  if (scope === 'selection+paragraph') {
    return { ...base, paragraph: selection.paragraph }
  }

  const page = await extractPageContent()
  return {
    ...base,
    paragraph: selection.paragraph,
    pageText: page.text,
    title: page.title || selection.pageTitle,
  }
}

function noop() {}

export type { TrimResult }
