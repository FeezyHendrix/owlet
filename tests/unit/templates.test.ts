import { listUsedVars, renderTemplate } from '@shared/templates'
import { describe, expect, it } from 'vitest'

describe('renderTemplate', () => {
  it('replaces known variables', () => {
    const out = renderTemplate('Hello {{selection}} from {{title}}', {
      selection: 'world',
      title: 'page',
    })
    expect(out).toBe('Hello world from page')
  })

  it('preserves unknown variables', () => {
    const out = renderTemplate('{{unknown}} {{selection}}', { selection: 'x' })
    expect(out).toBe('{{unknown}} x')
  })

  it('preserves missing known variables', () => {
    const out = renderTemplate('{{selection}} {{paragraph}}', { selection: 'x' })
    expect(out).toBe('x {{paragraph}}')
  })

  it('handles empty templates', () => {
    expect(renderTemplate('', { selection: 'x' })).toBe('')
  })
})

describe('listUsedVars', () => {
  it('returns unique known variables in template', () => {
    const vars = listUsedVars('{{selection}} {{paragraph}} {{selection}} {{unknown}}')
    expect(vars.sort()).toEqual(['paragraph', 'selection'])
  })

  it('returns empty array when no variables used', () => {
    expect(listUsedVars('plain text')).toEqual([])
  })
})
