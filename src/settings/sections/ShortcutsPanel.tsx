import { useEffect, useState } from 'preact/hooks'
import { SectionHeader } from '../components/SectionHeader'
import { useSettings } from '../store'

const SHORTCUTS_URL = 'chrome://extensions/shortcuts'

export function ShortcutsPanel() {
  const ui = useSettings((s) => s.config.ui)
  const [bindings, setBindings] = useState<chrome.commands.Command[] | null>(null)

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.commands?.getAll) {
      setBindings([])
      return
    }
    chrome.commands.getAll((cmds) => setBindings(cmds))
  }, [])

  const trigger = bindings?.find((c) => c.name === 'trigger-contextext')

  return (
    <div>
      <SectionHeader
        title="Shortcuts"
        description="Browser-level keyboard shortcuts. Edit in your browser's extension shortcut settings."
      />

      <div class="space-y-4">
        <div class="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-medium">Open Contextext on selection</div>
              <div class="mt-1 text-xs text-neutral-500">
                Opens the popover for the current selection — same as clicking the FAB.
              </div>
            </div>
            <kbd class="rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950">
              {trigger?.shortcut || ui.hotkey || 'unset'}
            </kbd>
          </div>
        </div>

        <div class="rounded-xl border border-dashed border-neutral-300 p-4 text-sm dark:border-neutral-700">
          <p class="text-neutral-700 dark:text-neutral-300">
            To change a shortcut, open your browser's extension shortcuts page:
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                chrome.tabs.create({ url: SHORTCUTS_URL })
              }
            }}
            class="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:border-neutral-500 dark:border-neutral-700"
          >
            Open chrome://extensions/shortcuts
          </button>
          <p class="mt-2 text-xs text-neutral-500">
            On Firefox, use about:addons → gear icon → Manage Extension Shortcuts.
          </p>
        </div>
      </div>
    </div>
  )
}
