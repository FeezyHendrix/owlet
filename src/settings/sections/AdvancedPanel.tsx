import { type Config, ConfigSchema, DEFAULT_CONFIG } from '@shared/schema'
import { useRef, useState } from 'preact/hooks'
import { SectionHeader } from '../components/SectionHeader'
import { useSettings } from '../store'

type Status =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

export function AdvancedPanel() {
  const config = useSettings((s) => s.config)
  const patch = useSettings((s) => s.patch)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [confirmingWipe, setConfirmingWipe] = useState(false)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contextext-config-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus({ kind: 'success', message: 'Exported config (without API keys).' })
  }

  const importJson = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = ConfigSchema.safeParse(JSON.parse(text))
      if (!parsed.success) {
        setStatus({ kind: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid config' })
        return
      }
      const next = parsed.data
      patch((draft) => {
        draft.providers = next.providers
        draft.actions = next.actions
        draft.defaultActionId = next.defaultActionId
        draft.ui = next.ui
        draft.siteRules = next.siteRules
      })
      setStatus({
        kind: 'success',
        message: 'Imported config. API keys were not included — re-enter them in Providers.',
      })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const resetDefaults = () => {
    patch((draft) => {
      const fresh: Config = DEFAULT_CONFIG
      draft.providers = fresh.providers
      draft.actions = fresh.actions
      draft.defaultActionId = fresh.defaultActionId
      draft.ui = fresh.ui
      draft.siteRules = fresh.siteRules
    })
    setConfirmingReset(false)
    setStatus({ kind: 'success', message: 'Reset to defaults. API keys preserved.' })
  }

  const wipeAll = async () => {
    try {
      await chrome.storage.local.clear()
      await chrome.storage.sync.clear()
      setConfirmingWipe(false)
      setStatus({
        kind: 'success',
        message: 'All data cleared. Reopen settings to start fresh.',
      })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div>
      <SectionHeader
        title="Advanced"
        description="Backup, restore, and reset. API keys are never included in exports."
      />

      <div class="space-y-4">
        <Card
          title="Export configuration"
          description="Download your settings as a JSON file. API keys are excluded."
        >
          <button
            type="button"
            onClick={exportJson}
            class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:border-neutral-500 dark:border-neutral-700"
          >
            Download JSON
          </button>
        </Card>

        <Card
          title="Import configuration"
          description="Replace your current providers, actions, and preferences with a saved config."
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            class="hidden"
            onChange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0]
              if (file) importJson(file)
              if (fileRef.current) fileRef.current.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:border-neutral-500 dark:border-neutral-700"
          >
            Choose JSON file…
          </button>
        </Card>

        <Card
          title="Reset to defaults"
          description="Clear all providers, actions, and site rules. API keys remain on disk until you wipe them."
        >
          {confirmingReset ? (
            <div class="flex items-center gap-2">
              <span class="text-sm text-neutral-700 dark:text-neutral-300">
                Are you sure? This cannot be undone.
              </span>
              <button
                type="button"
                onClick={resetDefaults}
                class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                class="rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300"
            >
              Reset configuration
            </button>
          )}
        </Card>

        <Card
          title="Wipe all data"
          description="Permanently delete everything: settings, API keys, and any cached state."
          tone="danger"
        >
          {confirmingWipe ? (
            <div class="flex items-center gap-2">
              <span class="text-sm text-red-700 dark:text-red-400">
                This deletes everything, including API keys. Continue?
              </span>
              <button
                type="button"
                onClick={wipeAll}
                class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, wipe all
              </button>
              <button
                type="button"
                onClick={() => setConfirmingWipe(false)}
                class="rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingWipe(true)}
              class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              Wipe all data…
            </button>
          )}
        </Card>

        {status.kind !== 'idle' && (
          <output
            aria-live="polite"
            class={`block rounded-lg border px-3 py-2 text-sm ${
              status.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
            }`}
          >
            {status.message}
          </output>
        )}
      </div>
    </div>
  )
}

function Card({
  title,
  description,
  children,
  tone,
}: {
  title: string
  description: string
  children: preact.ComponentChildren
  tone?: 'danger'
}) {
  return (
    <div
      class={`rounded-xl border p-4 ${
        tone === 'danger'
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/10'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <div class="mb-3">
        <div class="text-sm font-semibold">{title}</div>
        <div class="mt-0.5 text-xs text-neutral-500">{description}</div>
      </div>
      {children}
    </div>
  )
}
