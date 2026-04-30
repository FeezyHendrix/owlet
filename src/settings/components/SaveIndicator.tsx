import { useSettings } from '../store'

export function SaveIndicator() {
  const status = useSettings((s) => s.saveStatus)
  const error = useSettings((s) => s.saveError)

  if (status === 'idle') return null

  const label =
    status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : `Error: ${error ?? 'unknown'}`

  const tone =
    status === 'error'
      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
      : status === 'saved'
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
        : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'

  return (
    <output
      aria-live="polite"
      class={`rounded-full px-3 py-1 text-xs font-medium tabular-nums transition ${tone}`}
    >
      {label}
    </output>
  )
}
