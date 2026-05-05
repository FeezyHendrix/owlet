import type { ChatMessage } from '@/background/llm/types'
import { STREAM_PORT, type StreamEvent, type StreamRequest } from '@/background/stream-protocol'
import {
  type Conversation,
  deleteConversation,
  listConversations,
  onConversationsChange,
  saveConversation,
} from '@shared/conversations'
import type { Action, Config } from '@shared/schema'
import { loadConfig, onConfigChange } from '@shared/storage'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import lockupDark from '../assets/logo/lockup-dark.svg?url'
import lockupLight from '../assets/logo/lockup-light.svg?url'
import { renderMarkdown } from '../content/markdown'

const OPEN_KEY = 'owlet.sidepanel.openConversationId'

export function SidePanel() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    listConversations().then(setConversations)
    loadConfig().then(setConfig)

    const offConvs = onConversationsChange(setConversations)
    const offConfig = onConfigChange(setConfig)

    chrome.storage.local.get(OPEN_KEY).then((res) => {
      const id = res[OPEN_KEY]
      if (typeof id === 'string') {
        setActiveId(id)
        chrome.storage.local.remove(OPEN_KEY)
      }
    })

    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local') return
      const change = changes[OPEN_KEY]
      if (change && typeof change.newValue === 'string') {
        setActiveId(change.newValue)
        chrome.storage.local.remove(OPEN_KEY)
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => {
      offConvs()
      offConfig()
      chrome.storage.onChanged.removeListener(onStorage)
    }
  }, [])

  const active = useMemo(
    () => (activeId ? conversations.find((c) => c.id === activeId) : null) ?? null,
    [activeId, conversations],
  )

  if (active && config) {
    return (
      <ChatView
        conversation={active}
        config={config}
        onBack={() => setActiveId(null)}
        onDelete={async () => {
          await deleteConversation(active.id)
          setActiveId(null)
        }}
      />
    )
  }

  return (
    <ListView
      conversations={conversations}
      config={config}
      onOpen={setActiveId}
      onNew={async () => {
        if (!config) return
        const seed = newChatSeed(config)
        if (!seed) return
        const conv: Conversation = {
          id: `c_${crypto.randomUUID()}`,
          title: 'New conversation',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          providerId: seed.providerId,
          actionId: seed.actionId,
          model: seed.model,
          systemPrompt: seed.systemPrompt,
          messages: [],
        }
        await saveConversation(conv)
        setActiveId(conv.id)
      }}
      onDelete={async (id) => {
        await deleteConversation(id)
        if (activeId === id) setActiveId(null)
      }}
    />
  )
}

function ListView({
  conversations,
  config,
  onOpen,
  onNew,
  onDelete,
}: {
  conversations: Conversation[]
  config: Config | null
  onOpen: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  const canStart = config ? newChatSeed(config) !== null : false

  return (
    <main class="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div class="flex items-center gap-2">
          <img src={lockupDark} alt="Owlet" class="h-6 w-auto dark:hidden" />
          <img src={lockupLight} alt="Owlet" class="hidden h-6 w-auto dark:block" />
        </div>
        <button
          type="button"
          disabled={!canStart}
          onClick={onNew}
          class="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          New chat
        </button>
      </header>

      {conversations.length === 0 ? (
        <div class="flex flex-1 items-center justify-center p-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {canStart
            ? 'No conversations yet. Highlight text on a page and open it here, or start a new chat.'
            : 'Add an LLM provider in Settings to start chatting.'}
        </div>
      ) : (
        <ul class="flex-1 divide-y divide-neutral-100 overflow-auto dark:divide-neutral-900">
          {conversations.map((c) => (
            <li key={c.id}>
              <ConversationRow conversation={c} onOpen={onOpen} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function ConversationRow({
  conversation,
  onOpen,
  onDelete,
}: {
  conversation: Conversation
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div class="group flex items-center gap-2 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900">
      <button
        type="button"
        onClick={() => onOpen(conversation.id)}
        class="min-w-0 flex-1 text-left"
      >
        <div class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {conversation.title}
        </div>
        <div class="mt-0.5 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{formatRelative(conversation.updatedAt)}</span>
          <span>·</span>
          <span>{messageCountLabel(conversation.messages)}</span>
          {conversation.source ? (
            <>
              <span>·</span>
              <span class="truncate">{hostname(conversation.source.pageUrl)}</span>
            </>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        aria-label="Delete conversation"
        onClick={() => onDelete(conversation.id)}
        class="opacity-0 transition group-hover:opacity-100 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        ✕
      </button>
    </div>
  )
}

function ChatView({
  conversation,
  config,
  onBack,
  onDelete,
}: {
  conversation: Conversation
  config: Config
  onBack: () => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const provider = config.providers.find((p) => p.id === conversation.providerId) ?? null
  const scrollSignal = `${conversation.messages.length}:${streamBuffer.length}`

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !scrollSignal) return
    el.scrollTop = el.scrollHeight
  }, [scrollSignal])

  useEffect(() => {
    return () => {
      portRef.current?.disconnect()
    }
  }, [])

  const send = async () => {
    const value = draft.trim()
    if (!value || streaming || !provider) return
    setDraft('')
    setError(null)

    const userMessage: ChatMessage = { role: 'user', content: value }
    const next: Conversation = {
      ...conversation,
      title: conversation.messages.length === 0 ? truncate(value, 60) : conversation.title,
      messages: [...conversation.messages, userMessage],
      updatedAt: Date.now(),
    }
    await saveConversation(next)

    setStreaming(true)
    setStreamBuffer('')

    const port = chrome.runtime.connect({ name: STREAM_PORT })
    portRef.current = port

    let buffer = ''
    let finished = false

    port.onMessage.addListener((event: StreamEvent) => {
      if (event.type === 'text') {
        buffer += event.value
        setStreamBuffer(buffer)
      } else if (event.type === 'done') {
        finished = true
        finalize(buffer, null)
      } else if (event.type === 'error') {
        finished = true
        finalize(buffer, event.message)
      }
    })

    port.onDisconnect.addListener(() => {
      if (!finished) finalize(buffer, chrome.runtime.lastError?.message ?? 'Connection closed')
    })

    const messagesForLlm: ChatMessage[] = []
    if (conversation.systemPrompt.trim()) {
      messagesForLlm.push({ role: 'system', content: conversation.systemPrompt })
    }
    for (const m of next.messages) {
      if (m.role !== 'system') messagesForLlm.push(m)
    }

    const startMessage: StreamRequest = {
      type: 'start',
      providerId: provider.id,
      request: {
        model: conversation.model,
        messages: messagesForLlm,
      },
    }
    port.postMessage(startMessage)

    async function finalize(text: string, err: string | null) {
      portRef.current = null
      setStreaming(false)
      setStreamBuffer('')
      if (err && !text) {
        setError(err)
        return
      }
      const assistantMessage: ChatMessage = { role: 'assistant', content: text }
      await saveConversation({
        ...next,
        messages: [...next.messages, assistantMessage],
        updatedAt: Date.now(),
      })
      if (err) setError(err)
    }
  }

  const stop = () => {
    const port = portRef.current
    if (!port) return
    try {
      port.postMessage({ type: 'abort' })
    } catch {}
    try {
      port.disconnect()
    } catch {}
  }

  return (
    <main class="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header class="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <button
          type="button"
          aria-label="Back to conversations"
          onClick={onBack}
          class="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          ←
        </button>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold">{conversation.title}</div>
          <div class="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {provider ? `${provider.label} · ${conversation.model}` : 'Provider unavailable'}
          </div>
        </div>
        <button
          type="button"
          aria-label="Delete conversation"
          onClick={onDelete}
          class="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-red-400"
        >
          Delete
        </button>
      </header>

      <div ref={scrollRef} class="flex-1 overflow-auto px-4 py-3">
        {conversation.source ? <SourceCard source={conversation.source} /> : null}
        {conversation.messages
          .filter((m) => m.role !== 'system')
          .map((m, i) => (
            <MessageBubble key={`${i}-${m.role}`} message={m} />
          ))}
        {streaming ? (
          <MessageBubble message={{ role: 'assistant', content: streamBuffer || '…' }} streaming />
        ) : null}
        {error ? (
          <div class="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>

      <form
        class="border-t border-neutral-200 px-3 py-2 dark:border-neutral-800"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div class="flex items-end gap-2">
          <textarea
            value={draft}
            onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={provider ? 'Message Owlet…' : 'Provider unavailable'}
            disabled={!provider}
            rows={1}
            class="max-h-40 min-h-[36px] flex-1 resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              class="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim() || !provider}
              class="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </main>
  )
}

function MessageBubble({
  message,
  streaming,
}: {
  message: ChatMessage
  streaming?: boolean
}) {
  const isUser = message.role === 'user'
  const html = isUser ? null : renderMarkdown(message.content)
  return (
    <div class={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        class={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
            : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100'
        }`}
      >
        {isUser ? (
          <div class="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div
            class={`ctx-md ${streaming ? 'opacity-90' : ''}`}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: html is sanitized by DOMPurify in renderMarkdown
            dangerouslySetInnerHTML={{ __html: html ?? '' }}
          />
        )}
      </div>
    </div>
  )
}

function SourceCard({ source }: { source: NonNullable<Conversation['source']> }) {
  return (
    <div class="mb-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div class="truncate font-medium text-neutral-700 dark:text-neutral-300">
        {source.pageTitle || hostname(source.pageUrl)}
      </div>
      <a
        href={source.pageUrl}
        target="_blank"
        rel="noreferrer"
        class="block truncate text-neutral-500 hover:underline dark:text-neutral-400"
      >
        {source.pageUrl}
      </a>
      <div class="mt-1 line-clamp-3 text-neutral-600 italic dark:text-neutral-400">
        “{source.selectionText}”
      </div>
    </div>
  )
}

function newChatSeed(
  config: Config,
): { providerId: string; actionId: string; model: string; systemPrompt: string } | null {
  const action = pickDefaultAction(config)
  if (!action) return null
  const provider = config.providers.find((p) => p.id === action.providerId)
  if (!provider) return null
  return {
    providerId: provider.id,
    actionId: action.id,
    model: action.model || provider.defaultModel,
    systemPrompt: action.systemPrompt,
  }
}

function pickDefaultAction(config: Config): Action | null {
  if (config.defaultActionId) {
    const found = config.actions.find((a) => a.id === config.defaultActionId)
    if (found) return found
  }
  return config.actions[0] ?? null
}

function messageCountLabel(messages: ChatMessage[]): string {
  const visible = messages.filter((m) => m.role !== 'system').length
  return visible === 1 ? '1 message' : `${visible} messages`
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length <= n ? clean : `${clean.slice(0, n - 1)}…`
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.round(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
