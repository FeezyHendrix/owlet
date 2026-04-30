import { charBudgetForTokens, estimateTokens, trimToCharBudget } from '@shared/tokens'
import { describe, expect, it } from 'vitest'

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('rounds up by 4 chars per token', () => {
    expect(estimateTokens('a')).toBe(1)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
  })
})

describe('charBudgetForTokens', () => {
  it('multiplies tokens by 4', () => {
    expect(charBudgetForTokens(100)).toBe(400)
    expect(charBudgetForTokens(0)).toBe(0)
  })

  it('clamps negatives to zero', () => {
    expect(charBudgetForTokens(-5)).toBe(0)
  })
})

describe('trimToCharBudget', () => {
  it('returns text unchanged when under budget', () => {
    const result = trimToCharBudget('hello world', 100)
    expect(result.trimmed).toBe(false)
    expect(result.text).toBe('hello world')
    expect(result.originalChars).toBe(11)
    expect(result.finalChars).toBe(11)
  })

  it('keeps both head and tail when over budget', () => {
    const long = `${'a'.repeat(1000)}XYZ${'b'.repeat(1000)}`
    const result = trimToCharBudget(long, 200)
    expect(result.trimmed).toBe(true)
    expect(result.text).toContain('…[trimmed]…')
    expect(result.text.length).toBeLessThanOrEqual(200)
    expect(result.text.startsWith('a')).toBe(true)
    expect(result.text.endsWith('b')).toBe(true)
    expect(result.originalChars).toBe(2003)
  })

  it('falls back to slice when budget is smaller than marker', () => {
    const result = trimToCharBudget('abcdef', 3)
    expect(result.trimmed).toBe(true)
    expect(result.text).toBe('abc')
  })
})
