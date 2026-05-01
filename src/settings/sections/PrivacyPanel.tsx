import type { SiteRule } from '@shared/schema'
import { useState } from 'preact/hooks'
import { SectionHeader } from '../components/SectionHeader'
import { useSettings } from '../store'

export function PrivacyPanel() {
  const siteRules = useSettings((s) => s.config.siteRules)
  const patch = useSettings((s) => s.patch)

  const [pattern, setPattern] = useState('')
  const [enabled, setEnabled] = useState(false)

  const addRule = () => {
    const trimmed = pattern.trim()
    if (!trimmed) return
    if (siteRules.some((r) => r.pattern === trimmed)) {
      setPattern('')
      return
    }
    patch((draft) => {
      draft.siteRules.push({ pattern: trimmed, enabled })
    })
    setPattern('')
  }

  const toggle = (target: SiteRule) => {
    patch((draft) => {
      const rule = draft.siteRules.find((r) => r.pattern === target.pattern)
      if (rule) rule.enabled = !rule.enabled
    })
  }

  const remove = (target: SiteRule) => {
    patch((draft) => {
      draft.siteRules = draft.siteRules.filter((r) => r.pattern !== target.pattern)
    })
  }

  return (
    <div>
      <SectionHeader
        title="Privacy & Sites"
        description="Control where Owlet runs. Selections are sent only to the LLM you configured."
      />

      <div class="mb-6 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/50">
        <PrivacyPoint>
          API keys live in{' '}
          <code class="rounded bg-white px-1 dark:bg-neutral-950">chrome.storage.local</code> and
          never leave this device.
        </PrivacyPoint>
        <PrivacyPoint>
          Settings (excluding keys) sync via{' '}
          <code class="rounded bg-white px-1 dark:bg-neutral-950">chrome.storage.sync</code>.
        </PrivacyPoint>
        <PrivacyPoint>
          Selections only ever go to the provider you set up. No telemetry, no analytics.
        </PrivacyPoint>
      </div>

      <div class="mb-4">
        <h3 class="text-sm font-semibold">Site rules</h3>
        <p class="mt-1 text-xs text-neutral-500">
          Override the default per-site. Patterns match against the page hostname (e.g.{' '}
          <code class="rounded bg-neutral-100 px-1 dark:bg-neutral-800">github.com</code>,{' '}
          <code class="rounded bg-neutral-100 px-1 dark:bg-neutral-800">*.bank.com</code>).
        </p>
      </div>

      <div class="mb-4 flex gap-2">
        <input
          type="text"
          value={pattern}
          placeholder="example.com"
          spellcheck={false}
          onInput={(e) => setPattern((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addRule()
          }}
          class="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white dark:focus:ring-white/10"
        />
        <select
          value={enabled ? 'on' : 'off'}
          onChange={(e) => setEnabled((e.currentTarget as HTMLSelectElement).value === 'on')}
          class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="off">Disable on this site</option>
          <option value="on">Enable on this site</option>
        </select>
        <button
          type="button"
          onClick={addRule}
          disabled={!pattern.trim()}
          class="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Add
        </button>
      </div>

      {siteRules.length === 0 ? (
        <div class="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No site rules. Owlet is enabled everywhere by default.
        </div>
      ) : (
        <ul class="space-y-2">
          {siteRules.map((rule) => (
            <li
              key={rule.pattern}
              class="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div class="flex items-center gap-3">
                <code class="rounded bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                  {rule.pattern}
                </code>
                <span
                  class={`text-xs font-medium ${
                    rule.enabled
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {rule.enabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggle(rule)}
                  class="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-500 dark:border-neutral-700"
                >
                  Toggle
                </button>
                <button
                  type="button"
                  onClick={() => remove(rule)}
                  class="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PrivacyPoint({ children }: { children: preact.ComponentChildren }) {
  return (
    <div class="flex items-start gap-2">
      <span aria-hidden="true" class="mt-0.5 text-emerald-600 dark:text-emerald-400">
        ✓
      </span>
      <span class="text-neutral-700 dark:text-neutral-300">{children}</span>
    </div>
  )
}
