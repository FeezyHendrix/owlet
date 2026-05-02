import type { Provider } from '@shared/schema'
import { readApiKey } from '@shared/storage'
import { createAnthropicAdapter } from './anthropic'
import { createOpenAIAdapter } from './openai'
import type { LLMAdapter } from './types'

export async function getAdapter(provider: Provider): Promise<LLMAdapter> {
  const apiKey = await readApiKey(provider.apiKeyRef)
  if (!apiKey) {
    throw new Error(`No API key configured for provider "${provider.label}"`)
  }
  return buildAdapter(provider.kind, provider.baseUrl, apiKey)
}

export function buildAdapter(kind: Provider['kind'], baseUrl: string, apiKey: string): LLMAdapter {
  switch (kind) {
    case 'openai':
    case 'openai-compatible':
      return createOpenAIAdapter({ kind, baseUrl, apiKey })
    case 'anthropic':
      return createAnthropicAdapter({ kind, baseUrl, apiKey })
  }
}

export const DEFAULT_BASE_URLS: Record<Provider['kind'], string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  'openai-compatible': '',
}

export type CompatiblePreset = {
  id: string
  label: string
  baseUrl: string
  defaultModel: string
}

export const COMPATIBLE_PRESETS: CompatiblePreset[] = [
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2-0905-preview',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA (build.nvidia.com)',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
  },
]
