import { uid } from '@shared/defaults'
import type { Action, ContextScope, Provider } from '@shared/schema'
import { TEMPLATE_VARS, renderTemplate } from '@shared/templates'
import type { ComponentChildren } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { SectionHeader } from '../components/SectionHeader'
import { useSettings } from '../store'

const SCOPE_OPTIONS: { value: ContextScope; label: string; hint: string }[] = [
  { value: 'selection', label: 'Selection only', hint: 'Just the highlighted text.' },
  {
    value: 'selection+paragraph',
    label: 'Selection + paragraph',
    hint: 'Highlight plus the surrounding paragraph.',
  },
  { value: 'full-page', label: 'Full page', hint: 'Whole page content (extracted).' },
]

const SAMPLE_VARS: Record<(typeof TEMPLATE_VARS)[number], string> = {
  selection: 'quantum entanglement',
  paragraph: 'Quantum entanglement is a phenomenon where particles share a state across distance.',
  pageText: '(full page text would appear here)',
  title: 'Wikipedia — Quantum entanglement',
  url: 'https://en.wikipedia.org/wiki/Quantum_entanglement',
}

export function ActionsPanel() {
  const actions = useSettings((s) => s.config.actions)
  const providers = useSettings((s) => s.config.providers)
  const defaultActionId = useSettings((s) => s.config.defaultActionId)
  const upsert = useSettings((s) => s.upsertAction)
  const remove = useSettings((s) => s.removeAction)
  const setDefault = useSettings((s) => s.setDefaultAction)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const canAdd = providers.length > 0

  return (
    <div>
      <SectionHeader
        title="Actions"
        description="Prompts you can run on a selection. The default action runs on FAB click."
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={!canAdd}
            class="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            + Add action
          </button>
        }
      />

      {!canAdd && (
        <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Add a provider first — actions need somewhere to send the prompt.
        </div>
      )}

      {actions.length === 0 && canAdd && !creating && (
        <div class="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No actions yet. Add one to get started.
        </div>
      )}

      <ul class="space-y-3">
        {actions.map((a) =>
          editingId === a.id ? (
            <li key={a.id}>
              <ActionEditor
                initial={a}
                providers={providers}
                onSave={(next) => {
                  upsert(next)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
                onDelete={() => {
                  remove(a.id)
                  setEditingId(null)
                }}
              />
            </li>
          ) : (
            <li key={a.id}>
              <ActionRow
                action={a}
                provider={providers.find((p) => p.id === a.providerId)}
                isDefault={defaultActionId === a.id}
                onEdit={() => setEditingId(a.id)}
                onMakeDefault={() => setDefault(a.id)}
              />
            </li>
          ),
        )}
      </ul>

      {creating && canAdd && (
        <div class="mt-3">
          <ActionEditor
            providers={providers}
            onSave={(next) => {
              upsert(next)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}
    </div>
  )
}

function ActionRow({
  action,
  provider,
  isDefault,
  onEdit,
  onMakeDefault,
}: {
  action: Action
  provider: Provider | undefined
  isDefault: boolean
  onEdit: () => void
  onMakeDefault: () => void
}) {
  return (
    <div class="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={onEdit}
        class="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span class="text-xl" aria-hidden="true">
          {action.icon || '✦'}
        </span>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium">{action.name}</span>
            {isDefault && (
              <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                default
              </span>
            )}
            <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {action.contextScope}
            </span>
          </div>
          <div class="mt-1 truncate text-xs text-neutral-500">
            {provider
              ? `${provider.label} · ${action.model || provider.defaultModel}`
              : 'No provider'}
          </div>
        </div>
      </button>
      {!isDefault && (
        <button
          type="button"
          onClick={onMakeDefault}
          class="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-500 dark:border-neutral-700"
        >
          Make default
        </button>
      )}
    </div>
  )
}

function ActionEditor({
  initial,
  providers,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Action
  providers: Provider[]
  onSave: (action: Action) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const firstProvider = providers[0]
  const [name, setName] = useState(initial?.name ?? 'New action')
  const [icon, setIcon] = useState(initial?.icon ?? '✦')
  const [providerId, setProviderId] = useState(initial?.providerId ?? firstProvider?.id ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [contextScope, setContextScope] = useState<ContextScope>(
    initial?.contextScope ?? 'selection+paragraph',
  )
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '')
  const [userPromptTemplate, setUserPromptTemplate] = useState(
    initial?.userPromptTemplate ?? 'Help with this:\n\n{{selection}}',
  )
  const [maxTokens, setMaxTokens] = useState(String(initial?.maxTokens ?? 600))
  const [temperature, setTemperature] = useState(String(initial?.temperature ?? 0.3))

  const preview = useMemo(
    () => renderTemplate(userPromptTemplate, SAMPLE_VARS),
    [userPromptTemplate],
  )

  const insertVar = (v: string) => {
    setUserPromptTemplate((prev) => `${prev}{{${v}}}`)
  }

  const handleSave = () => {
    if (!providerId) return
    const next: Action = {
      id: initial?.id ?? uid('act'),
      name: name.trim() || 'Action',
      icon: icon.trim() || '✦',
      providerId,
      contextScope,
      systemPrompt,
      userPromptTemplate,
      ...(model.trim() ? { model: model.trim() } : {}),
      ...(Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0
        ? { maxTokens: Math.floor(Number(maxTokens)) }
        : {}),
      ...(Number.isFinite(Number(temperature)) ? { temperature: Number(temperature) } : {}),
    }
    onSave(next)
  }

  return (
    <div class="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="grid grid-cols-[80px_1fr] gap-3">
        <Field label="Icon">
          <Input value={icon} onInput={setIcon} />
        </Field>
        <Field label="Name">
          <Input value={name} onInput={setName} />
        </Field>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <Field label="Provider">
          <Select value={providerId} onChange={setProviderId}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model override" hint="Leave blank to use the provider's default model.">
          <Input
            value={model}
            onInput={setModel}
            placeholder={providers.find((p) => p.id === providerId)?.defaultModel ?? ''}
            spellcheck={false}
          />
        </Field>
      </div>

      <Field label="Context scope">
        <div class="space-y-2">
          {SCOPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              class={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                contextScope === opt.value
                  ? 'border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-950'
                  : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700'
              }`}
            >
              <input
                type="radio"
                name="scope"
                value={opt.value}
                checked={contextScope === opt.value}
                onChange={() => setContextScope(opt.value)}
                class="mt-0.5"
              />
              <div>
                <div class="font-medium">{opt.label}</div>
                <div class="text-xs text-neutral-500">{opt.hint}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>

      <Field label="System prompt" hint="Sets the assistant's role and tone.">
        <Textarea value={systemPrompt} onInput={setSystemPrompt} rows={3} />
      </Field>

      <Field
        label="User prompt template"
        hint="Use double-brace variables. Click a chip to insert."
      >
        <div class="mb-2 flex flex-wrap gap-1.5">
          {TEMPLATE_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVar(v)}
              class="rounded-md border border-neutral-300 px-2 py-0.5 text-xs font-mono hover:border-neutral-500 dark:border-neutral-700"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
        <Textarea value={userPromptTemplate} onInput={setUserPromptTemplate} rows={6} mono />
      </Field>

      <Field label="Live preview" hint="Rendered with sample values.">
        <pre class="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
          {preview}
        </pre>
      </Field>

      <div class="grid grid-cols-2 gap-3">
        <Field label="Max tokens">
          <Input value={maxTokens} onInput={setMaxTokens} type="number" />
        </Field>
        <Field label="Temperature">
          <Input value={temperature} onInput={setTemperature} type="number" />
        </Field>
      </div>

      <div class="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            class="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Delete action
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
            disabled={!providerId}
            class="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {initial ? 'Save changes' : 'Add action'}
          </button>
        </div>
      </div>
    </div>
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

function Textarea({
  value,
  onInput,
  rows = 3,
  mono,
}: {
  value: string
  onInput: (v: string) => void
  rows?: number
  mono?: boolean
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onInput={(e) => onInput((e.currentTarget as HTMLTextAreaElement).value)}
      class={`w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white dark:focus:ring-white/10 ${
        mono ? 'font-mono' : ''
      }`}
    />
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: ComponentChildren
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}
      class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white dark:focus:ring-white/10"
    >
      {children}
    </select>
  )
}
