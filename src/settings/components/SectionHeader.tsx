import type { ComponentChildren } from 'preact'

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ComponentChildren
}) {
  return (
    <div class="mb-6 flex items-end justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
      <div>
        <h2 class="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
        )}
      </div>
      {action && <div class="shrink-0">{action}</div>}
    </div>
  )
}
