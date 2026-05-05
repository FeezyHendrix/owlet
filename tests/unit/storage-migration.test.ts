import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Bag = Record<string, unknown>

function makeChromeMock() {
  const sync: Bag = {}
  const local: Bag = {}
  return {
    storage: {
      sync: {
        get: vi.fn(async (key: string) => (key in sync ? { [key]: sync[key] } : {})),
        set: vi.fn(async (entries: Bag) => Object.assign(sync, entries)),
      },
      local: {
        get: vi.fn(async (key: string) => (key in local ? { [key]: local[key] } : {})),
        set: vi.fn(async (entries: Bag) => Object.assign(local, entries)),
      },
    },
    _sync: sync,
    _local: local,
  }
}

const CONFIG_KEY = 'owlet.config.v1'
const FLAG_KEY = 'owlet.migrations.askInjected.v1'

describe('loadConfig — Ask injection migration', () => {
  let mock: ReturnType<typeof makeChromeMock>

  beforeEach(() => {
    mock = makeChromeMock()
    ;(globalThis as unknown as { chrome: unknown }).chrome = mock
    vi.resetModules()
  })

  afterEach(() => {
    ;(globalThis as { chrome?: unknown }).chrome = undefined
  })

  it('injects Ask… at top when missing and providers exist', async () => {
    mock._sync[CONFIG_KEY] = {
      version: 1,
      providers: [
        {
          id: 'p1',
          label: 'OpenAI',
          kind: 'openai',
          baseUrl: 'https://api.openai.com',
          apiKeyRef: 'p1',
          defaultModel: 'gpt-4o-mini',
        },
      ],
      actions: [
        {
          id: 'a1',
          name: 'Explain',
          kind: 'preset',
          systemPrompt: 's',
          userPromptTemplate: 'u {{selection}}',
          contextScope: 'selection',
          providerId: 'p1',
        },
      ],
      defaultActionId: 'a1',
    }
    const { loadConfig } = await import('../../src/shared/storage')
    const cfg = await loadConfig()
    expect(cfg.actions).toHaveLength(2)
    expect(cfg.actions[0]?.kind).toBe('ask')
    expect(cfg.actions[0]?.providerId).toBe('p1')
    expect(mock._local[FLAG_KEY]).toBe(true)
    expect((mock._sync[CONFIG_KEY] as { actions: unknown[] }).actions).toHaveLength(2)
  })

  it('does not re-inject if migration flag is set', async () => {
    mock._local[FLAG_KEY] = true
    mock._sync[CONFIG_KEY] = {
      version: 1,
      providers: [
        {
          id: 'p1',
          label: 'OpenAI',
          kind: 'openai',
          baseUrl: 'https://api.openai.com',
          apiKeyRef: 'p1',
          defaultModel: 'gpt-4o-mini',
        },
      ],
      actions: [],
      defaultActionId: null,
    }
    const { loadConfig } = await import('../../src/shared/storage')
    const cfg = await loadConfig()
    expect(cfg.actions).toHaveLength(0)
  })

  it('skips when ask already exists', async () => {
    mock._sync[CONFIG_KEY] = {
      version: 1,
      providers: [
        {
          id: 'p1',
          label: 'OpenAI',
          kind: 'openai',
          baseUrl: 'https://api.openai.com',
          apiKeyRef: 'p1',
          defaultModel: 'gpt-4o-mini',
        },
      ],
      actions: [
        {
          id: 'a1',
          name: 'Ask…',
          kind: 'ask',
          systemPrompt: 's',
          userPromptTemplate: 'u {{question}}',
          contextScope: 'selection',
          providerId: 'p1',
        },
      ],
      defaultActionId: 'a1',
    }
    const { loadConfig } = await import('../../src/shared/storage')
    const cfg = await loadConfig()
    expect(cfg.actions).toHaveLength(1)
    expect(mock._local[FLAG_KEY]).toBeUndefined()
  })

  it('skips when no providers exist', async () => {
    mock._sync[CONFIG_KEY] = {
      version: 1,
      providers: [],
      actions: [],
      defaultActionId: null,
    }
    const { loadConfig } = await import('../../src/shared/storage')
    const cfg = await loadConfig()
    expect(cfg.actions).toHaveLength(0)
    expect(mock._local[FLAG_KEY]).toBeUndefined()
  })
})
