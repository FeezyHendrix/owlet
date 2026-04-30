import {
  type Action,
  type Config,
  ConfigSchema,
  DEFAULT_CONFIG,
  type Provider,
} from '@shared/schema'
import { loadConfig, onConfigChange, saveConfig } from '@shared/storage'
import { create } from 'zustand'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type SettingsStore = {
  config: Config
  loaded: boolean
  saveStatus: SaveStatus
  saveError: string | null
  init: () => Promise<void>
  patch: (mut: (draft: Config) => void) => void
  upsertProvider: (provider: Provider) => void
  removeProvider: (id: string) => void
  upsertAction: (action: Action) => void
  removeAction: (id: string) => void
  setDefaultAction: (id: string | null) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 300

export const useSettings = create<SettingsStore>((set, get) => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  saveStatus: 'idle',
  saveError: null,

  init: async () => {
    const config = await loadConfig()
    set({ config, loaded: true })
    onConfigChange((next) => {
      if (JSON.stringify(next) !== JSON.stringify(get().config)) {
        set({ config: next })
      }
    })
  },

  patch: (mut) => {
    const draft = structuredClone(get().config)
    mut(draft)
    const parsed = ConfigSchema.safeParse(draft)
    if (!parsed.success) {
      set({ saveStatus: 'error', saveError: parsed.error.issues[0]?.message ?? 'Invalid config' })
      return
    }
    set({ config: parsed.data, saveStatus: 'saving', saveError: null })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      try {
        await saveConfig(parsed.data)
        set({ saveStatus: 'saved' })
        setTimeout(() => {
          if (get().saveStatus === 'saved') set({ saveStatus: 'idle' })
        }, 1500)
      } catch (err) {
        set({
          saveStatus: 'error',
          saveError: err instanceof Error ? err.message : String(err),
        })
      }
    }, SAVE_DEBOUNCE_MS)
  },

  upsertProvider: (provider) =>
    get().patch((draft) => {
      const idx = draft.providers.findIndex((p) => p.id === provider.id)
      if (idx >= 0) draft.providers[idx] = provider
      else draft.providers.push(provider)
    }),

  removeProvider: (id) =>
    get().patch((draft) => {
      draft.providers = draft.providers.filter((p) => p.id !== id)
      draft.actions = draft.actions.filter((a) => a.providerId !== id)
      if (draft.actions.length === 0) draft.defaultActionId = null
      else if (!draft.actions.some((a) => a.id === draft.defaultActionId)) {
        draft.defaultActionId = draft.actions[0]?.id ?? null
      }
    }),

  upsertAction: (action) =>
    get().patch((draft) => {
      const idx = draft.actions.findIndex((a) => a.id === action.id)
      if (idx >= 0) draft.actions[idx] = action
      else {
        draft.actions.push(action)
        if (!draft.defaultActionId) draft.defaultActionId = action.id
      }
    }),

  removeAction: (id) =>
    get().patch((draft) => {
      draft.actions = draft.actions.filter((a) => a.id !== id)
      if (draft.defaultActionId === id) {
        draft.defaultActionId = draft.actions[0]?.id ?? null
      }
    }),

  setDefaultAction: (id) =>
    get().patch((draft) => {
      draft.defaultActionId = id
    }),
}))
