import { describe, expect, it } from 'vitest'
import { ConfigSchema, DEFAULT_CONFIG } from '../../src/shared/schema'

describe('ConfigSchema', () => {
  it('accepts the default config', () => {
    expect(() => ConfigSchema.parse(DEFAULT_CONFIG)).not.toThrow()
  })

  it('rejects unknown version', () => {
    const bad = { ...DEFAULT_CONFIG, version: 999 } as unknown
    expect(() => ConfigSchema.parse(bad)).toThrow()
  })

  it('rejects providers with invalid baseUrl', () => {
    const bad = {
      ...DEFAULT_CONFIG,
      providers: [
        {
          id: 'p1',
          label: 'Test',
          kind: 'openai',
          baseUrl: 'not-a-url',
          apiKeyRef: 'p1',
          defaultModel: 'gpt-4o-mini',
        },
      ],
    }
    expect(() => ConfigSchema.parse(bad)).toThrow()
  })
})
