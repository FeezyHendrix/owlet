import { useEffect, useState } from 'preact/hooks'
import { renderMarkdown } from '../content/markdown'

type Payload = {
  title?: string
  markdown?: string
  ts?: number
}

const KEY = 'sidepanel.payload'

export function SidePanel() {
  const [payload, setPayload] = useState<Payload | null>(null)

  useEffect(() => {
    let cancelled = false
    chrome.storage.local.get(KEY).then((res) => {
      if (cancelled) return
      const value = res[KEY] as Payload | undefined
      if (value) setPayload(value)
    })

    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== 'local' || !changes[KEY]) return
      const next = changes[KEY].newValue as Payload | undefined
      setPayload(next ?? null)
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(onChange)
    }
  }, [])

  if (!payload) {
    return (
      <main class="p-6 text-sm text-neutral-600 dark:text-neutral-400">
        <h1 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">Contextext</h1>
        <p class="mt-2">
          Highlight text on a page and click the floating button to send it here. The latest result
          will appear in this side panel.
        </p>
      </main>
    )
  }

  const html = payload.markdown ? renderMarkdown(payload.markdown) : ''

  return (
    <main class="flex h-full flex-col">
      <header class="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h1 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {payload.title || 'Contextext'}
        </h1>
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          onClick={async () => {
            await chrome.storage.local.remove(KEY)
            setPayload(null)
          }}
        >
          Clear
        </button>
      </header>
      <article
        class="ctx-md flex-1 overflow-auto p-4 text-sm text-neutral-900 dark:text-neutral-100"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: html is sanitized by DOMPurify in renderMarkdown
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  )
}
