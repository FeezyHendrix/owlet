import { COMPATIBLE_PRESETS, DEFAULT_BASE_URLS } from '@/background/llm/registry'
import { makeBuiltinActions, makeProvider } from '@shared/defaults'
import { testConnection as rpcTest } from '@shared/rpc'
import { type Config, ConfigSchema, type Provider, type ProviderKind } from '@shared/schema'
import { loadConfig, readApiKey, saveConfig, writeApiKey } from '@shared/storage'
import type { ComponentChildren } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import lockupDark from '../assets/logo/lockup-dark.svg?url'
import lockupLight from '../assets/logo/lockup-light.svg?url'

type StepId = 'welcome' | 'provider' | 'try'
const STEPS: StepId[] = ['welcome', 'provider', 'try']

const STEP_KEY = 'owlet.onboarding.step'
const COMPLETE_KEY = 'owlet.onboarding.complete'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; models?: string[] }
  | { status: 'error'; message: string }

export function Onboarding() {
  const [step, setStep] = useState<StepId>(() => {
    const saved = localStorage.getItem(STEP_KEY) as StepId | null
    return saved && STEPS.includes(saved) ? saved : 'welcome'
  })
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    loadConfig().then(setConfig)
  }, [])

  useEffect(() => {
    localStorage.setItem(STEP_KEY, step)
  }, [step])

  const goNext = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) {
      const next = STEPS[idx + 1]
      if (next) setStep(next)
    } else {
      finish()
    }
  }

  const goPrev = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) {
      const prev = STEPS[idx - 1]
      if (prev) setStep(prev)
    }
  }

  const finish = () => {
    localStorage.setItem(COMPLETE_KEY, '1')
    localStorage.removeItem(STEP_KEY)
    if (typeof chrome !== 'undefined' && chrome.tabs?.getCurrent) {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id !== undefined) chrome.tabs.remove(tab.id)
      })
    }
  }

  return (
    <div class="min-h-screen">
      <Header step={step} />
      <main class="mx-auto max-w-2xl px-6 pb-16 pt-8">
        {step === 'welcome' && <WelcomeStep onNext={goNext} onSkip={finish} />}
        {step === 'provider' && config && (
          <ProviderStep
            config={config}
            onSaved={(next) => setConfig(next)}
            onNext={goNext}
            onBack={goPrev}
            onSkip={finish}
          />
        )}
        {step === 'try' && (
          <TryStep config={config} onFinish={finish} onBack={goPrev} onSkip={finish} />
        )}
      </main>
    </div>
  )
}

function Header({ step }: { step: StepId }) {
  const idx = STEPS.indexOf(step)
  return (
    <header class="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div class="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-2">
          <img src={lockupDark} alt="Owlet" class="h-7 w-auto dark:hidden" />
          <img src={lockupLight} alt="Owlet" class="hidden h-7 w-auto dark:block" />
        </div>
        <ol class="flex items-center gap-2" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <li key={s} class="flex items-center gap-2">
              <span
                aria-current={i === idx ? 'step' : undefined}
                class={`h-2 w-8 rounded-full transition ${
                  i <= idx ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-800'
                }`}
              />
            </li>
          ))}
        </ol>
      </div>
    </header>
  )
}

function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <Card>
      <div class="mb-6 text-6xl" aria-hidden="true">
        ✦
      </div>
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome to Owlet</h1>
      <p class="mt-3 text-base text-neutral-600 dark:text-neutral-400">
        Highlight any text on the web. Get instant context from your own LLM.
      </p>

      <ul class="mx-auto mt-8 grid max-w-md gap-3 text-left text-sm">
        <Bullet>
          Bring your own key — OpenAI, Anthropic, Kimi, Groq, Ollama, anything compatible.
        </Bullet>
        <Bullet>Streaming responses, right next to your selection.</Bullet>
        <Bullet>Customizable actions: Explain, Summarize, Translate, Define — or your own.</Bullet>
        <Bullet>Keys live on your device. No telemetry. No accounts.</Bullet>
      </ul>

      <div class="mt-10 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onNext}
          class="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Get started →
        </button>
        <button
          type="button"
          onClick={onSkip}
          class="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Skip setup
        </button>
      </div>
    </Card>
  )
}

function ProviderStep({
  config,
  onSaved,
  onNext,
  onBack,
  onSkip,
}: {
  config: Config
  onSaved: (config: Config) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const existing = config.providers[0]
  const [kind, setKind] = useState<ProviderKind>(existing?.kind ?? 'openai')
  const [label, setLabel] = useState(existing?.label ?? 'OpenAI')
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? DEFAULT_BASE_URLS.openai)
  const [defaultModel, setDefaultModel] = useState(existing?.defaultModel ?? 'gpt-4o-mini')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)

  const applyKind = (next: ProviderKind) => {
    setKind(next)
    setTest({ status: 'idle' })
    if (next === 'openai') {
      setLabel('OpenAI')
      setBaseUrl(DEFAULT_BASE_URLS.openai)
      setDefaultModel('gpt-4o-mini')
    } else if (next === 'anthropic') {
      setLabel('Anthropic')
      setBaseUrl(DEFAULT_BASE_URLS.anthropic)
      setDefaultModel('claude-haiku-4-5')
    } else {
      setLabel('Custom provider')
      setBaseUrl('')
      setDefaultModel('')
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
    if (!apiKey) {
      setTest({ status: 'error', message: 'Enter an API key first' })
      return
    }
    if (!baseUrl) {
      setTest({ status: 'error', message: 'Enter a base URL first' })
      return
    }
    setTest({ status: 'testing' })
    const result = await rpcTest({ kind, baseUrl }, apiKey)
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

  const handleSaveAndContinue = async () => {
    if (saving) return
    if (!apiKey || !baseUrl || !defaultModel || !label) return
    setSaving(true)
    try {
      const provider: Provider = makeProvider({ kind, label, baseUrl, defaultModel })
      const actions = makeBuiltinActions(provider.id)
      const next: Config = ConfigSchema.parse({
        ...config,
        providers: [provider, ...config.providers],
        actions: [...actions, ...config.actions],
        defaultActionId: config.defaultActionId ?? actions[0]?.id ?? null,
      })
      await writeApiKey(provider.apiKeyRef, apiKey)
      await saveConfig(next)
      onSaved(next)
      onNext()
    } catch (err) {
      setTest({
        status: 'error',
        message: `Save failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setSaving(false)
    }
  }

  const canSave = Boolean(apiKey && baseUrl && defaultModel && label) && test.status !== 'testing'

  return (
    <Card>
      <h1 class="text-2xl font-semibold tracking-tight">Connect your LLM</h1>
      <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Pick a provider and paste your key. Stored locally on this device only.
      </p>

      <div class="mt-6 space-y-5 text-left">
        <Field label="Provider">
          <div class="grid grid-cols-3 gap-2">
            {(['openai', 'anthropic', 'openai-compatible'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => applyKind(k)}
                class={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  kind === k
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500'
                }`}
              >
                {kindLabel(k)}
              </button>
            ))}
          </div>
        </Field>

        {kind === 'openai-compatible' && (
          <Field label="Quick presets" hint="Click to fill in URL and default model.">
            <div class="flex flex-wrap gap-2">
              {COMPATIBLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  class="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:border-neutral-500 dark:border-neutral-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {kind === 'openai-compatible' && (
          <div class="grid grid-cols-2 gap-3">
            <Field label="Label">
              <Input value={label} onInput={setLabel} />
            </Field>
            <Field label="Base URL">
              <Input value={baseUrl} onInput={setBaseUrl} spellcheck={false} />
            </Field>
          </div>
        )}

        <Field
          label="Default model"
          hint={kind === 'openai-compatible' ? 'Model identifier from your provider.' : undefined}
        >
          <Input value={defaultModel} onInput={setDefaultModel} spellcheck={false} />
        </Field>

        <Field
          label="API key"
          hint="Stored in chrome.storage.local. Never synced. Never sent anywhere except your provider."
        >
          <div class="flex gap-2">
            <Input
              value={apiKey}
              onInput={setApiKey}
              type={showKey ? 'text' : 'password'}
              placeholder={kind === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
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

        <div class="flex items-center gap-3">
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
      </div>

      <div class="mt-8 flex items-center justify-between border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <button
          type="button"
          onClick={onBack}
          class="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          ← Back
        </button>
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            class="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Skip — I'll do it later
          </button>
          <button
            type="button"
            onClick={handleSaveAndContinue}
            disabled={!canSave || saving}
            class="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {saving ? 'Saving…' : 'Save & continue →'}
          </button>
        </div>
      </div>
    </Card>
  )
}

const SAMPLE_TEXT = `Quantum entanglement is a phenomenon in which two or more particles share a single quantum state, such that measuring one instantly determines the state of the others, no matter how far apart they are. Einstein famously called this "spooky action at a distance," and decades of experiments — most recently the loophole-free Bell tests — have confirmed it.`

function TryStep({
  config,
  onFinish,
  onBack,
  onSkip,
}: {
  config: Config | null
  onFinish: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [selection, setSelection] = useState('')

  const provider = config?.providers[0]

  useEffect(() => {
    if (!provider) {
      setHasKey(false)
      return
    }
    readApiKey(provider.apiKeyRef).then((k) => setHasKey(Boolean(k)))
  }, [provider])

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection()
      if (!sel) return
      const text = sel.toString().trim()
      // Only react if the selection is inside the sample paragraph
      const sampleEl = document.getElementById('owlet-sample')
      if (!sampleEl) return
      if (sel.anchorNode && sampleEl.contains(sel.anchorNode)) {
        setSelection(text)
      } else if (!text) {
        setSelection('')
      }
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  const openWikipedia = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'https://en.wikipedia.org/wiki/Quantum_entanglement' })
    } else {
      window.open('https://en.wikipedia.org/wiki/Quantum_entanglement', '_blank')
    }
  }

  return (
    <Card>
      <h1 class="text-2xl font-semibold tracking-tight">Try it out</h1>
      <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Highlight any phrase in the paragraph below. On real pages, a small ✦ button appears next to
        your selection.
      </p>

      <div class="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-left text-base leading-relaxed dark:border-neutral-800 dark:bg-neutral-900/50">
        <p id="owlet-sample" class="select-text text-neutral-800 dark:text-neutral-200">
          {SAMPLE_TEXT}
        </p>
      </div>

      <SelectionFeedback selection={selection} />

      <SetupSummary provider={provider ?? null} hasKey={hasKey} />

      <div class="mt-8 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={openWikipedia}
          class="rounded-lg border border-neutral-300 px-4 py-3 text-sm font-medium hover:border-neutral-500 dark:border-neutral-700"
        >
          🌐 Try on Wikipedia
        </button>
        <button
          type="button"
          onClick={onFinish}
          class="rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Finish setup ✓
        </button>
      </div>

      <div class="mt-6 flex items-center justify-between border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <button
          type="button"
          onClick={onBack}
          class="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSkip}
          class="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Skip
        </button>
      </div>
    </Card>
  )
}

function SelectionFeedback({ selection }: { selection: string }) {
  const charCount = selection.length
  const visible = charCount > 0
  return (
    <div
      aria-live="polite"
      class={`mt-4 overflow-hidden rounded-lg border transition-all ${
        visible
          ? 'max-h-48 border-emerald-200 bg-emerald-50 p-4 opacity-100 dark:border-emerald-900/40 dark:bg-emerald-950/30'
          : 'max-h-0 border-transparent p-0 opacity-0'
      }`}
    >
      {visible && (
        <div class="text-left text-sm">
          <div class="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
            <span aria-hidden="true">✦</span>
            <span>You selected {charCount} characters</span>
          </div>
          <blockquote class="mt-2 line-clamp-2 italic text-emerald-900/80 dark:text-emerald-200/80">
            "{selection}"
          </blockquote>
          <p class="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            On a real page, the ✦ button appears here. Click it to send this to your LLM.
          </p>
        </div>
      )}
    </div>
  )
}

function SetupSummary({
  provider,
  hasKey,
}: {
  provider: Provider | null
  hasKey: boolean | null
}) {
  const status = useMemo(() => {
    if (!provider)
      return {
        tone: 'warn',
        text: 'No provider configured. Skip back to step 2 or finish and configure later in Settings.',
      }
    if (hasKey === null) return { tone: 'info', text: 'Checking provider…' }
    if (!hasKey)
      return {
        tone: 'warn',
        text: `Provider "${provider.label}" is set up, but no API key was saved.`,
      }
    return {
      tone: 'ok',
      text: `Ready: ${provider.label} · ${provider.defaultModel}`,
    }
  }, [provider, hasKey])

  const cls =
    status.tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
      : status.tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200'
        : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'

  return <div class={`mt-4 rounded-lg border px-3 py-2 text-xs ${cls}`}>{status.text}</div>
}

function Card({ children }: { children: ComponentChildren }) {
  return (
    <div class="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-10">
      {children}
    </div>
  )
}

function Bullet({ children }: { children: ComponentChildren }) {
  return (
    <li class="flex items-start gap-2 text-neutral-700 dark:text-neutral-300">
      <span aria-hidden="true" class="mt-0.5 text-emerald-600 dark:text-emerald-400">
        ✓
      </span>
      <span>{children}</span>
    </li>
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
  children: ComponentChildren
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
  spellcheck,
}: {
  value: string
  onInput: (v: string) => void
  type?: string
  placeholder?: string
  spellcheck?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      spellcheck={spellcheck}
      onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white dark:focus:ring-white/10"
    />
  )
}

function kindLabel(kind: ProviderKind): string {
  if (kind === 'openai') return 'OpenAI'
  if (kind === 'anthropic') return 'Anthropic'
  return 'Custom'
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
