import { useEffect, useState } from 'preact/hooks'
import { SaveIndicator } from './components/SaveIndicator'
import { AboutPanel } from './sections/AboutPanel'
import { ActionsPanel } from './sections/ActionsPanel'
import { AdvancedPanel } from './sections/AdvancedPanel'
import { AppearancePanel } from './sections/AppearancePanel'
import { PrivacyPanel } from './sections/PrivacyPanel'
import { ProvidersPanel } from './sections/ProvidersPanel'
import { ShortcutsPanel } from './sections/ShortcutsPanel'
import { useSettings } from './store'

type SectionId =
  | 'providers'
  | 'actions'
  | 'appearance'
  | 'shortcuts'
  | 'privacy'
  | 'advanced'
  | 'about'

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'providers', label: 'Providers', icon: '🔌' },
  { id: 'actions', label: 'Actions', icon: '⚡' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
  { id: 'privacy', label: 'Privacy & Sites', icon: '🔒' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
]

const LAST_SECTION_KEY = 'owlet.settings.lastSection'

export function Settings() {
  const { init, loaded } = useSettings()
  const [section, setSection] = useState<SectionId>(() => {
    const saved = localStorage.getItem(LAST_SECTION_KEY) as SectionId | null
    return saved && SECTIONS.some((s) => s.id === saved) ? saved : 'providers'
  })

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    localStorage.setItem(LAST_SECTION_KEY, section)
  }, [section])

  if (!loaded) {
    return (
      <div class="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    )
  }

  return (
    <div class="min-h-screen">
      <header class="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div class="flex items-center gap-3">
            <span class="text-xl" aria-hidden="true">
              ✦
            </span>
            <h1 class="text-base font-semibold tracking-tight">Owlet Settings</h1>
          </div>
          <SaveIndicator />
        </div>
      </header>

      <div class="mx-auto grid max-w-6xl grid-cols-[200px_1fr] gap-8 px-6 py-8">
        <nav aria-label="Settings sections" class="space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              class={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                section === s.id
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900'
              }`}
            >
              <span aria-hidden="true">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <main class="min-w-0">
          {section === 'providers' && <ProvidersPanel />}
          {section === 'actions' && <ActionsPanel />}
          {section === 'appearance' && <AppearancePanel />}
          {section === 'shortcuts' && <ShortcutsPanel />}
          {section === 'privacy' && <PrivacyPanel />}
          {section === 'advanced' && <AdvancedPanel />}
          {section === 'about' && <AboutPanel />}
        </main>
      </div>
    </div>
  )
}
