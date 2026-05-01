import { autoUpdate, computePosition, flip, inline, offset, shift } from '@floating-ui/dom'
import type { Action } from '@shared/schema'
import type { CapturedSelection } from './selection'

export type FabHandle = {
  destroy: () => void
}

export type FabOptions = {
  actions?: Action[]
  defaultActionId?: string | null
  onPickAction?: (action: Action) => void
}

export function showFab(
  parent: HTMLElement,
  selection: CapturedSelection,
  onClick: () => void,
  options: FabOptions = {},
): FabHandle {
  const { actions = [], onPickAction } = options
  const showChevron = actions.length > 1 && !!onPickAction

  const wrap = document.createElement('div')
  wrap.style.cssText = [
    'position: absolute',
    'top: 0',
    'left: 0',
    'display: inline-flex',
    'align-items: stretch',
    'border-radius: 9999px',
    'background: rgb(23 23 23)',
    'color: rgb(250 250 250)',
    'box-shadow: 0 4px 14px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06) inset',
    'opacity: 0',
    'transform: translate3d(0, -4px, 0) scale(0.96)',
    'transition: opacity 120ms ease, transform 120ms ease',
    'will-change: transform, opacity',
    'overflow: hidden',
  ].join(';')

  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', 'Open Owlet')
  button.style.cssText = [
    'all: unset',
    'cursor: pointer',
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'padding: 6px 10px',
    'font-size: 12px',
    'font-weight: 600',
    'color: inherit',
    'font-family: inherit',
  ].join(';')
  button.innerHTML = '<span>Owlet</span>'
  button.addEventListener('mousedown', (e) => e.preventDefault())
  button.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  })
  wrap.appendChild(button)

  let menuEl: HTMLElement | null = null
  let chevron: HTMLButtonElement | null = null

  if (showChevron) {
    const divider = document.createElement('div')
    divider.style.cssText = 'width: 1px; background: rgba(255,255,255,0.15);'
    wrap.appendChild(divider)

    chevron = document.createElement('button')
    chevron.type = 'button'
    chevron.setAttribute('aria-label', 'Choose action')
    chevron.setAttribute('aria-haspopup', 'menu')
    chevron.setAttribute('aria-expanded', 'false')
    chevron.style.cssText = [
      'all: unset',
      'cursor: pointer',
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'padding: 0 8px',
      'font-size: 10px',
      'color: inherit',
      'font-family: inherit',
    ].join(';')
    chevron.innerHTML = '<span aria-hidden="true">▾</span>'
    chevron.addEventListener('mousedown', (e) => e.preventDefault())
    chevron.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      toggleMenu()
    })
    wrap.appendChild(chevron)
  }

  parent.appendChild(wrap)

  const reference = createVirtualReference(selection)

  const update = () => {
    computePosition(reference, wrap, {
      strategy: 'fixed',
      placement: 'top',
      middleware: [inline(), offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      wrap.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) scale(1)`
      wrap.style.opacity = '1'
    })
  }

  const cleanup = autoUpdate(reference, wrap, update, { animationFrame: true })

  const closeMenu = () => {
    if (!menuEl) return
    menuEl.remove()
    menuEl = null
    chevron?.setAttribute('aria-expanded', 'false')
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onMenuKey, true)
  }

  const onDocClick = (e: MouseEvent) => {
    if (!menuEl) return
    if (e.target instanceof Node && menuEl.contains(e.target)) return
    closeMenu()
  }

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeMenu()
      chevron?.focus()
    }
  }

  const toggleMenu = () => {
    if (menuEl) {
      closeMenu()
      return
    }
    if (!chevron) return

    menuEl = document.createElement('div')
    menuEl.setAttribute('role', 'menu')
    menuEl.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'min-width: 180px',
      'padding: 4px',
      'border-radius: 10px',
      'background: rgb(255 255 255)',
      'color: rgb(23 23 23)',
      'box-shadow: 0 12px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
      'font-size: 13px',
      'z-index: 1',
    ].join(';')
    if (parent.dataset.theme === 'dark') {
      menuEl.style.background = 'rgb(38 38 38)'
      menuEl.style.color = 'rgb(245 245 245)'
      menuEl.style.boxShadow = '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)'
    }

    for (const action of actions) {
      const item = document.createElement('button')
      item.type = 'button'
      item.setAttribute('role', 'menuitem')
      item.style.cssText = [
        'all: unset',
        'cursor: pointer',
        'display: flex',
        'align-items: center',
        'gap: 8px',
        'padding: 7px 10px',
        'border-radius: 6px',
        'width: 100%',
        'box-sizing: border-box',
        'font-family: inherit',
        'font-size: 13px',
      ].join(';')
      item.innerHTML = `<span>${escapeHtml(action.name)}</span>`
      item.addEventListener('mouseenter', () => {
        item.style.background =
          parent.dataset.theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
      })
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent'
      })
      item.addEventListener('mousedown', (e) => e.preventDefault())
      item.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        closeMenu()
        onPickAction?.(action)
      })
      menuEl.appendChild(item)
    }

    parent.appendChild(menuEl)
    chevron.setAttribute('aria-expanded', 'true')

    const menuCleanup = autoUpdate(
      wrap,
      menuEl,
      () => {
        if (!menuEl) return
        computePosition(wrap, menuEl, {
          strategy: 'fixed',
          placement: 'bottom-end',
          middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
        }).then(({ x, y }) => {
          if (!menuEl) return
          menuEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
        })
      },
      { animationFrame: true },
    )

    const wrappedClose = () => {
      menuCleanup()
      closeMenu()
    }
    ;(menuEl as HTMLElement & { __close?: () => void }).__close = wrappedClose

    setTimeout(() => {
      document.addEventListener('click', onDocClick, true)
      document.addEventListener('keydown', onMenuKey, true)
    }, 0)
  }

  return {
    destroy: () => {
      const close = (menuEl as (HTMLElement & { __close?: () => void }) | null)?.__close
      if (close) close()
      else closeMenu()
      cleanup()
      wrap.remove()
    },
  }
}

function createVirtualReference(selection: CapturedSelection) {
  return {
    getBoundingClientRect: () => {
      const live = safeRangeRect(selection.range)
      return live ?? selection.rect
    },
    getClientRects: () => {
      try {
        return selection.range.getClientRects()
      } catch {
        return [selection.rect] as unknown as DOMRectList
      }
    },
  }
}

function safeRangeRect(range: Range): DOMRect | null {
  try {
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return null
    return rect
  } catch {
    return null
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
