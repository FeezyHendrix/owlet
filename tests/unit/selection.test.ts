import { describe, expect, it } from 'vitest'
import { captureSelection } from '../../src/content/selection'

function selectRange(textNode: Text, start: number, end: number) {
  const range = document.createRange()
  range.setStart(textNode, start)
  range.setEnd(textNode, end)
  const sel = window.getSelection()
  if (!sel) throw new Error('no selection api')
  sel.removeAllRanges()
  sel.addRange(range)
}

describe('captureSelection', () => {
  it('returns null when there is no selection', () => {
    document.body.innerHTML = '<p>nothing selected</p>'
    expect(captureSelection()).toBeNull()
  })

  it('returns null for selections shorter than the minimum threshold', () => {
    document.body.innerHTML = '<p>hi</p>'
    const p = document.querySelector('p')
    if (!p?.firstChild) throw new Error('test fixture missing')
    selectRange(p.firstChild as Text, 0, 2)
    expect(captureSelection()).toBeNull()
  })

  it('captures selection text and surrounding paragraph', () => {
    document.body.innerHTML =
      '<article><p id="p">The quick brown fox jumps over the lazy dog.</p></article>'
    const p = document.getElementById('p')
    if (!p?.firstChild) throw new Error('test fixture missing')
    selectRange(p.firstChild as Text, 4, 19)

    const result = captureSelection()
    expect(result).not.toBeNull()
    expect(result?.text).toBe('quick brown fox')
    expect(result?.paragraph).toBe('The quick brown fox jumps over the lazy dog.')
    expect(result?.pageTitle).toBe(document.title)
    expect(result?.pageUrl).toBe(location.href)
  })
})
