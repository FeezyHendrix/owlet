import { createConversation } from '@shared/conversations'
import type { RuntimeResponse } from '@shared/messages'
import type { SidePanelSeed } from '@shared/rpc'
import type { Provider } from '@shared/schema'
import { loadConfig } from '@shared/storage'
import { buildAdapter, getAdapter } from './llm/registry'
import {
  STREAM_PORT,
  type StreamControl,
  type StreamEvent,
  type StreamRequest,
} from './stream-protocol'

const ONBOARDING_URL = chrome.runtime.getURL('src/onboarding/index.html')
const SETTINGS_URL = chrome.runtime.getURL('src/settings/index.html')
const SIDE_PANEL_PATH = 'src/sidepanel/index.html'

if (chrome.sidePanel) {
  // Register the panel path for every tab so chrome.sidePanel.open() from an
  // RPC actually has something to open. Keep the toolbar action mapped to
  // settings (handled in onClicked), so the panel only opens via Owlet's
  // explicit "open in side panel" button in the popover.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
  chrome.sidePanel.setOptions({ path: SIDE_PANEL_PATH, enabled: true }).catch(() => {})
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.tabs.create({ url: ONBOARDING_URL, active: true })
  }
})

chrome.action.onClicked.addListener(async () => {
  const config = await loadConfig()
  const url = config.providers.length === 0 ? ONBOARDING_URL : SETTINGS_URL
  await chrome.tabs.create({ url, active: true })
})

type RpcMessage =
  | { type: 'ping' }
  | { type: 'open-settings' }
  | { type: 'open-onboarding' }
  | { type: 'open-side-panel'; seed?: SidePanelSeed }
  | {
      type: 'test-connection'
      provider: Pick<Provider, 'kind' | 'baseUrl'>
      apiKey: string
    }
  | {
      type: 'list-models'
      provider: Pick<Provider, 'kind' | 'baseUrl'>
      apiKey: string
    }

chrome.runtime.onMessage.addListener(
  (msg: RpcMessage, sender, sendResponse: (r: RuntimeResponse) => void) => {
    // chrome.sidePanel.open() must be called SYNCHRONOUSLY inside the
    // message listener to keep the user-gesture token alive. Any await
    // before it (config load, storage write, tabs.query) drops the
    // gesture and the call silently no-ops. Open first, persist seed
    // after — the side panel hydrates from chrome.storage.onChanged.
    if (msg.type === 'open-side-panel') {
      const tabId = sender.tab?.id
      if (chrome.sidePanel && tabId !== undefined) {
        chrome.sidePanel.open({ tabId }).catch(() => {})
      }
      if (msg.seed) {
        createConversation(msg.seed)
          .then((conv) =>
            chrome.storage.local.set({ 'owlet.sidepanel.openConversationId': conv.id }),
          )
          .catch(() => {})
      }
      sendResponse({ ok: true, data: null })
      return false
    }

    handleRpc(msg)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      )
    return true
  },
)

async function handleRpc(msg: RpcMessage): Promise<unknown> {
  switch (msg.type) {
    case 'ping':
      return { pong: true, version: chrome.runtime.getManifest().version }
    case 'open-settings':
      await chrome.tabs.create({ url: SETTINGS_URL, active: true })
      return null
    case 'open-onboarding':
      await chrome.tabs.create({ url: ONBOARDING_URL, active: true })
      return null
    case 'open-side-panel':
      // handled synchronously above to preserve the user gesture
      return null
    case 'test-connection': {
      const adapter = buildAdapter(msg.provider.kind, msg.provider.baseUrl, msg.apiKey)
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 15_000)
      try {
        return await adapter.testConnection(ac.signal)
      } finally {
        clearTimeout(timer)
      }
    }
    case 'list-models': {
      const adapter = buildAdapter(msg.provider.kind, msg.provider.baseUrl, msg.apiKey)
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 15_000)
      try {
        return await adapter.listModels(ac.signal)
      } finally {
        clearTimeout(timer)
      }
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== STREAM_PORT) return

  const ac = new AbortController()
  let active = false

  port.onMessage.addListener(async (raw: StreamRequest | StreamControl) => {
    if (raw.type === 'abort') {
      ac.abort()
      return
    }
    if (active) return
    active = true
    try {
      await runStream(raw, port, ac.signal)
    } finally {
      try {
        port.disconnect()
      } catch {
        // port may already be closed by the client
      }
    }
  })

  port.onDisconnect.addListener(() => {
    ac.abort()
  })
})

async function runStream(
  req: StreamRequest,
  port: chrome.runtime.Port,
  signal: AbortSignal,
): Promise<void> {
  const post = (event: StreamEvent) => {
    try {
      port.postMessage(event)
    } catch {
      // port disconnected; abort already wired through onDisconnect
    }
  }

  try {
    const config = await loadConfig()
    const provider = config.providers.find((p) => p.id === req.providerId)
    if (!provider) throw new Error(`Unknown provider id: ${req.providerId}`)

    const adapter = await getAdapter(provider)
    for await (const chunk of adapter.stream(req.request, signal)) {
      if (signal.aborted) return
      if (chunk.type === 'text') post({ type: 'text', value: chunk.value })
      else if (chunk.type === 'done') {
        post({ type: 'done' })
        return
      }
    }
    post({ type: 'done' })
  } catch (err) {
    if (signal.aborted) return
    const message = err instanceof Error ? err.message : String(err)
    post({ type: 'error', message })
  }
}
