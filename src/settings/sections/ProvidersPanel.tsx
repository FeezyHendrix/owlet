import { COMPATIBLE_PRESETS, DEFAULT_BASE_URLS } from '@/background/llm/registry'
import { makeProvider } from '@shared/defaults'
import { testConnection as rpcTest } from '@shared/rpc'
import type { Provider, ProviderKind } from '@shared/schema'
import { deleteApiKey, readApiKey, writeApiKey } from '@shared/storage'
import { useState } from 'preact/hooks'
import { SectionHeader } from '../components/SectionHeader'
import { useSettings } from '../store'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; models?: string[] }
  | { status: 'error'; message: string }

export function ProvidersPanel() {
  const providers = useSettings((s) => s.config.providers)
  const upsert = useSettings((s) => s.upsertProvider)
  const remove = useSettings((s) => s.removeProvider)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <SectionHeader
        title="Providers"
        description="Bring your own keys. OpenAI, Anthropic, or anything OpenAI-compatible."
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            class="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            + Add provider
          </button>
        }
      />

      {providers.length === 0 && !creating && (
        <div class="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No providers yet. Add one to start using Owlet.
        </div>
      )}

      <ul class="space-y-3">
        {providers.map((p) =>
          editingId === p.id ? (
            <li key={p.id}>
              <ProviderEditor
                initial={p}
                onSave={(next, key) => {
                  upsert(next)
                  if (key !== null) writeApiKey(next.apiKeyRef, key)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
                onDelete={() => {
                  deleteApiKey(p.apiKeyRef)
                  remove(p.id)
                  setEditingId(null)
                }}
              />
            </li>
          ) : (
            <li key={p.id}>
              <ProviderRow provider={p} onEdit={() => setEditingId(p.id)} />
            </li>
          ),
        )}
      </ul>

      {creating && (
        <div class="mt-3">
          <ProviderEditor
            onSave={(next, key) => {
              upsert(next)
              if (key !== null) writeApiKey(next.apiKeyRef, key)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}
    </div>
  )
}

function ProviderRow({ provider, onEdit }: { provider: Provider; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      class="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium">{provider.label}</span>
          <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {provider.kind}
          </span>
        </div>
        <div class="mt-1 truncate text-xs text-neutral-500">
          {provider.defaultModel} · {provider.baseUrl}
        </div>
      </div>
      <span class="text-xs text-neutral-400">Edit →</span>
    </button>
  )
}

function ProviderEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Provider
  onSave: (provider: Provider, apiKey: string | null) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [kind, setKind] = useState<ProviderKind>(initial?.kind ?? 'openai')
  const [label, setLabel] = useState(initial?.label ?? guessLabel('openai'))
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? DEFAULT_BASE_URLS.openai)
  const [defaultModel, setDefaultModel] = useState(initial?.defaultModel ?? 'gpt-4o-mini')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })

  const applyKind = (next: ProviderKind) => {
    setKind(next)
    if (next !== 'openai-compatible') {
      setBaseUrl(DEFAULT_BASE_URLS[next])
      setLabel(guessLabel(next))
      if (next === 'openai') setDefaultModel('gpt-4o-mini')
      if (next === 'anthropic') setDefaultModel('claude-haiku-4-5')
    }
  }

  const applyPreset = (presetId: string) => {
    const preset = COMPATIBLE_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setLabel(preset.label)
    setBaseUrl(preset.baseUrl)
    setDefaultModel(preset.defaultModel)
  }

  const handleTest = async () => {
    if (!apiKey && !initial) {
      setTest({ status: 'error', message: 'Enter an API key first' })
      return
    }
    setTest({ status: 'testing' })
    const keyToTest = apiKey || (initial ? ((await readApiKey(initial.apiKeyRef)) ?? '') : '')
    if (!keyToTest) {
      setTest({ status: 'error', message: 'No API key available to test' })
      return
    }
    const result = await rpcTest({ kind, baseUrl }, keyToTest)
    if (!result.ok) {
      setTest({ status: 'error', message: result.error })
      return
    }
    if (result.data.ok) {
      setTest({ status: 'ok', models: result.data.models })
    } else {
      setTest({ status: 'error', message: result.data.error })
    }
  }

  const handleSave = () => {
    const provider: Provider = initial
      ? { ...initial, kind, label, baseUrl, defaultModel }
      : makeProvider({ kind, label, baseUrl, defaultModel })
    onSave(provider, apiKey || null)
  }

  return (
    <div class="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <Field label="Provider type">
        <div class="flex gap-2">
          {(['openai', 'anthropic', 'openai-compatible'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => applyKind(k)}
              class={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                kind === k
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                  : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500'
              }`}
            >
              {labelFor(k)}
            </button>
          ))}
        </div>
      </Field>

      {kind === 'openai-compatible' && (
        <Field label="Quick presets">
          <div class="flex flex-wrap gap-2">
            {COMPATIBLE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                class="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-500 dark:border-neutral-700"
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Label">
        <Input value={label} onInput={setLabel} />
      </Field>

      <Field label="Base URL">
        <Input
          value={baseUrl}
          onInput={setBaseUrl}
          disabled={kind !== 'openai-compatible'}
          spellcheck={false}
        />
      </Field>

      <Field label="Default model">
        <Input value={defaultModel} onInput={setDefaultModel} spellcheck={false} />
      </Field>

      <Field
        label="API key"
        hint={
          initial
            ? 'Leave blank to keep existing key. Stored locally on this device only.'
            : 'Stored locally on this device only. Never synced.'
        }
      >
        <div class="flex gap-2">
          <Input
            value={apiKey}
            onInput={setApiKey}
            type={showKey ? 'text' : 'password'}
            placeholder={initial ? '••••••••••••••••' : 'sk-...'}
            spellcheck={false}
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            class="rounded-md border border-neutral-300 px-3 text-xs hover:border-neutral-500 dark:border-neutral-700"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </Field>

      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={test.status === 'testing'}
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700"
        >
          {test.status === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        <TestResult test={test} />
      </div>

      <div class="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            class="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Delete provider
          </button>
        ) : (
          <span />
        )}
        <div class="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            class="rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            class="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {initial ? 'Save changes' : 'Add provider'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TestResult({ test }: { test: TestState }) {
  if (test.status === 'idle') return null
  if (test.status === 'testing') {
    return <span class="text-xs text-neutral-500">Calling provider…</span>
  }
  if (test.status === 'ok') {
    return (
      <span class="text-xs font-medium text-emerald-700 dark:text-emerald-400">
        ✓ Connected{test.models?.length ? ` · ${test.models.length} models available` : ''}
      </span>
    )
  }
  return (
    <span class="text-xs font-medium text-red-700 dark:text-red-400" title={test.message}>
      ✗ {truncate(test.message, 80)}
    </span>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: preact.ComponentChildren
}) {
  return (
    <div class="block">
      <span class="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
      {children}
      {hint && <span class="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </div>
  )
}

function Input({
  value,
  onInput,
  type = 'text',
  placeholder,
  disabled,
  spellcheck,
}: {
  value: string
  onInput: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  spellcheck?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      spellcheck={spellcheck}
      onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white dark:focus:ring-white/10 dark:disabled:bg-neutral-900"
    />
  )
}

function labelFor(kind: ProviderKind): string {
  if (kind === 'openai') return 'OpenAI'
  if (kind === 'anthropic') return 'Anthropic'
  return 'Custom (compatible)'
}

function guessLabel(kind: ProviderKind): string {
  if (kind === 'openai') return 'OpenAI'
  if (kind === 'anthropic') return 'Anthropic'
  return 'Custom provider'
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
