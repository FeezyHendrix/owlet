import type { ChatMessage } from '@/background/llm/types'

const KEY = 'owlet.conversations.v1'
const MAX_CONVERSATIONS = 50

export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  providerId: string
  actionId: string
  model: string
  systemPrompt: string
  source?: {
    pageUrl: string
    pageTitle: string
    selectionText: string
  }
  messages: ChatMessage[]
}

export type ConversationSeed = {
  providerId: string
  actionId: string
  model: string
  systemPrompt: string
  source?: Conversation['source']
  messages: ChatMessage[]
  title?: string
}

export async function listConversations(): Promise<Conversation[]> {
  const raw = await chrome.storage.local.get(KEY)
  const value = raw[KEY]
  if (!Array.isArray(value)) return []
  return value.filter(isConversation).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const all = await listConversations()
  return all.find((c) => c.id === id) ?? null
}

export async function saveConversation(c: Conversation): Promise<void> {
  const all = await listConversations()
  const next = [c, ...all.filter((x) => x.id !== c.id)]
  const trimmed = next.slice(0, MAX_CONVERSATIONS)
  await chrome.storage.local.set({ [KEY]: trimmed })
}

export async function deleteConversation(id: string): Promise<void> {
  const all = await listConversations()
  await chrome.storage.local.set({ [KEY]: all.filter((c) => c.id !== id) })
}

export async function createConversation(seed: ConversationSeed): Promise<Conversation> {
  const now = Date.now()
  const conversation: Conversation = {
    id: cryptoId(),
    title: seed.title || deriveTitle(seed),
    createdAt: now,
    updatedAt: now,
    providerId: seed.providerId,
    actionId: seed.actionId,
    model: seed.model,
    systemPrompt: seed.systemPrompt,
    ...(seed.source ? { source: seed.source } : {}),
    messages: seed.messages,
  }
  await saveConversation(conversation)
  return conversation
}

export function onConversationsChange(handler: (list: Conversation[]) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local' || !changes[KEY]) return
    const value = changes[KEY].newValue
    handler(Array.isArray(value) ? value.filter(isConversation) : [])
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

function deriveTitle(seed: ConversationSeed): string {
  if (seed.source?.selectionText) return truncate(seed.source.selectionText, 60)
  const firstUser = seed.messages.find((m) => m.role === 'user')
  if (firstUser) return truncate(firstUser.content, 60)
  return 'New conversation'
}

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length <= n ? clean : `${clean.slice(0, n - 1)}…`
}

function cryptoId(): string {
  return `c_${crypto.randomUUID()}`
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    typeof v.providerId === 'string' &&
    typeof v.actionId === 'string' &&
    typeof v.model === 'string' &&
    typeof v.systemPrompt === 'string' &&
    Array.isArray(v.messages)
  )
}
