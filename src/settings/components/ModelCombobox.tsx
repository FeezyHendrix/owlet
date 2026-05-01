import { listModels as rpcListModels } from '@shared/rpc'
import type { ProviderKind } from '@shared/schema'
import { isModelsCacheFresh, readModelsCache, writeModelsCache } from '@shared/storage'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; count: number }
  | { status: 'error'; message: string }

type Props = {
  value: string
  onInput: (v: string) => void
  cacheKey: string
  provider: { kind: ProviderKind; baseUrl: string }
  getApiKey: () => Promise<string | null>
  placeholder?: string
  disabled?: boolean
}

export function ModelCombobox({
  value,
  onInput,
  cacheKey,
  provider,
  getApiKey,
  placeholder,
  disabled,
}: Props) {
  const [models, setModels] = useState<string[]>([])
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  const datalistId = useMemo(() => `models-${slug(cacheKey)}`, [cacheKey])
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    void (async () => {
      const cached = await readModelsCache(cacheKey)
      if (!mounted.current || !cached) return
      setModels(cached.models)
      if (isModelsCacheFresh(cached)) {
        setFetchState({ status: 'ok', count: cached.models.length })
      }
    })()
    return () => {
      mounted.current = false
    }
  }, [cacheKey])

  const refresh = async () => {
    const apiKey = await getApiKey()
    if (!apiKey) {
      setFetchState({ status: 'error', message: 'Add an API key first' })
      return
    }
    setFetchState({ status: 'loading' })
    const result = await rpcListModels(provider, apiKey)
    if (!mounted.current) return
    if (!result.ok) {
      setFetchState({ status: 'error', message: result.error })
      return
    }
    const sorted = [...result.data].sort((a, b) => a.localeCompare(b))
    setModels(sorted)
    setFetchState({ status: 'ok', count: sorted.length })
    await writeModelsCache(cacheKey, sorted)
  }

  return (
    <div class="space-y-1.5">
      <div class="flex gap-2">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          spellcheck={false}
          list={datalistId}
          onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
          class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white dark:focus:ring-white/10 dark:disabled:bg-neutral-900"
        />
        <datalist id={datalistId}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={refresh}
          disabled={disabled || fetchState.status === 'loading'}
          class="shrink-0 rounded-lg border border-neutral-300 px-3 text-xs hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700"
        >
          {fetchState.status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <FetchHint state={fetchState} cachedCount={models.length} />
    </div>
  )
}

function FetchHint({ state, cachedCount }: { state: FetchState; cachedCount: number }) {
  if (state.status === 'loading') {
    return <span class="text-xs text-neutral-500">Fetching models…</span>
  }
  if (state.status === 'ok') {
    return (
      <span class="text-xs text-neutral-500">
        {state.count} model{state.count === 1 ? '' : 's'} available — type to filter
      </span>
    )
  }
  if (state.status === 'error') {
    return (
      <span class="text-xs text-red-600 dark:text-red-400" title={state.message}>
        ✗ {truncate(state.message, 100)}
      </span>
    )
  }
  if (cachedCount > 0) {
    return (
      <span class="text-xs text-neutral-500">
        {cachedCount} cached model{cachedCount === 1 ? '' : 's'} — Refresh for latest
      </span>
    )
  }
  return (
    <span class="text-xs text-neutral-500">Type a model id, or click Refresh to list them</span>
  )
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
