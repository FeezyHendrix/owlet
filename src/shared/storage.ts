import { type Config, ConfigSchema, DEFAULT_CONFIG } from './schema'

const CONFIG_KEY = 'owlet.config.v1'

export async function loadConfig(): Promise<Config> {
  const raw = await chrome.storage.sync.get(CONFIG_KEY)
  const value = raw[CONFIG_KEY]
  if (!value) return DEFAULT_CONFIG
  const parsed = ConfigSchema.safeParse(value)
  if (!parsed.success) {
    await chrome.storage.local.set({
      [`${CONFIG_KEY}.corrupted.${Date.now()}`]: value,
    })
    return DEFAULT_CONFIG
  }
  return parsed.data
}

export async function saveConfig(config: Config): Promise<void> {
  const validated = ConfigSchema.parse(config)
  await chrome.storage.sync.set({ [CONFIG_KEY]: validated })
}

export function onConfigChange(handler: (config: Config) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'sync') return
    const change = changes[CONFIG_KEY]
    if (!change) return
    const parsed = ConfigSchema.safeParse(change.newValue)
    if (parsed.success) handler(parsed.data)
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

const KEY_PREFIX = 'owlet.key.'

export async function readApiKey(ref: string): Promise<string | null> {
  const k = `${KEY_PREFIX}${ref}`
  const raw = await chrome.storage.local.get(k)
  return typeof raw[k] === 'string' ? (raw[k] as string) : null
}

export async function writeApiKey(ref: string, value: string): Promise<void> {
  await chrome.storage.local.set({ [`${KEY_PREFIX}${ref}`]: value })
}

export async function deleteApiKey(ref: string): Promise<void> {
  await chrome.storage.local.remove(`${KEY_PREFIX}${ref}`)
}

const MODELS_CACHE_PREFIX = 'owlet.modelsCache.'
export const MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type ModelsCacheEntry = { fetchedAt: number; models: string[] }

export async function readModelsCache(cacheKey: string): Promise<ModelsCacheEntry | null> {
  const k = `${MODELS_CACHE_PREFIX}${cacheKey}`
  const raw = await chrome.storage.local.get(k)
  const value = raw[k]
  if (!value || typeof value !== 'object') return null
  const entry = value as { fetchedAt?: unknown; models?: unknown }
  if (typeof entry.fetchedAt !== 'number' || !Array.isArray(entry.models)) return null
  const models = entry.models.filter((m): m is string => typeof m === 'string')
  return { fetchedAt: entry.fetchedAt, models }
}

export async function writeModelsCache(cacheKey: string, models: string[]): Promise<void> {
  const k = `${MODELS_CACHE_PREFIX}${cacheKey}`
  const entry: ModelsCacheEntry = { fetchedAt: Date.now(), models }
  await chrome.storage.local.set({ [k]: entry })
}

export function isModelsCacheFresh(entry: ModelsCacheEntry, now = Date.now()): boolean {
  return now - entry.fetchedAt < MODELS_CACHE_TTL_MS
}
