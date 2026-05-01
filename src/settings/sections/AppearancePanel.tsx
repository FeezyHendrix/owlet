import type { ComponentChildren } from 'preact'
import { SectionHeader } from '../components/SectionHeader'
import { useSettings } from '../store'

export function AppearancePanel() {
  const ui = useSettings((s) => s.config.ui)
  const patch = useSettings((s) => s.patch)

  return (
    <div>
      <SectionHeader title="Appearance" description="Tune how Owlet looks and when it shows up." />

      <div class="space-y-6">
        <Group label="Theme" hint="Match your browser, or pin a mode.">
          <div class="flex gap-2">
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  patch((draft) => {
                    draft.ui.theme = t
                  })
                }
                class={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${
                  ui.theme === t
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Group>

        <Group
          label="Floating action button"
          hint="When enabled, a small button appears near your selection."
        >
          <Toggle
            checked={ui.fabEnabled}
            onChange={(v) =>
              patch((draft) => {
                draft.ui.fabEnabled = v
              })
            }
            label={ui.fabEnabled ? 'Enabled' : 'Disabled — use hotkey only'}
          />
        </Group>

        <Group
          label="Selection size limits"
          hint="Below the minimum or above the maximum, the FAB stays hidden."
        >
          <div class="grid grid-cols-2 gap-3">
            <NumberField
              label="Minimum characters"
              value={ui.minSelectionChars}
              min={1}
              onChange={(v) =>
                patch((draft) => {
                  draft.ui.minSelectionChars = v
                })
              }
            />
            <NumberField
              label="Maximum characters"
              value={ui.maxSelectionChars}
              min={100}
              onChange={(v) =>
                patch((draft) => {
                  draft.ui.maxSelectionChars = v
                })
              }
            />
          </div>
        </Group>
      </div>
    </div>
  )
}

function Group({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ComponentChildren
}) {
  return (
    <div>
      <div class="mb-2">
        <div class="text-sm font-medium">{label}</div>
        {hint && <div class="text-xs text-neutral-500">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      class="flex items-center gap-3"
    >
      <span
        class={`relative inline-block h-6 w-11 rounded-full transition ${
          checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'
        }`}
      >
        <span
          class={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition dark:bg-neutral-900 ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </span>
      <span class="text-sm">{label}</span>
    </button>
  )
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: number
  min: number
  onChange: (v: number) => void
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        onInput={(e) => {
          const n = Number((e.currentTarget as HTMLInputElement).value)
          if (Number.isFinite(n) && n >= min) onChange(Math.floor(n))
        }}
        class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white dark:focus:ring-white/10"
      />
    </label>
  )
}
