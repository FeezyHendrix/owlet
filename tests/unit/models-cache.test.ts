import { describe, expect, it } from 'vitest'
import { MODELS_CACHE_TTL_MS, isModelsCacheFresh } from '../../src/shared/storage'

describe('models cache TTL', () => {
  it('treats just-fetched entries as fresh', () => {
    const now = 1_000_000_000
    expect(isModelsCacheFresh({ fetchedAt: now, models: [] }, now)).toBe(true)
  })

  it('treats entries within TTL as fresh', () => {
    const now = 1_000_000_000
    const oneHourAgo = now - 60 * 60 * 1000
    expect(isModelsCacheFresh({ fetchedAt: oneHourAgo, models: [] }, now)).toBe(true)
  })

  it('treats entries beyond TTL as stale', () => {
    const now = 1_000_000_000
    const expired = now - MODELS_CACHE_TTL_MS - 1
    expect(isModelsCacheFresh({ fetchedAt: expired, models: [] }, now)).toBe(false)
  })

  it('TTL is exactly 24 hours', () => {
    expect(MODELS_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })
})
