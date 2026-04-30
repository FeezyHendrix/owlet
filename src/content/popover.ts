import { autoUpdate, computePosition, flip, inline, offset, shift } from '@floating-ui/dom'
import { renderMarkdown } from './markdown'
import type { CapturedSelection } from './selection'

export type PopoverHandle = {
  destroy: () => void
  setBody: (text: string) => void
  appendBody: (chunk: string) => void
  setError: (text: string) => void
  setStatus: (text: string | null) => void
  setOnDestroy: (cb: () => void) => void
  setOnFollowUp: (cb: ((prompt: string) => void) | null) => void
  setOnOpenSidePanel: (cb: (() => void) | null) => void
  setStreaming: (streaming: boolean) => void
  showFollowUpInput: () => void
}

export function showPopover(parent: HTMLElement, selection: CapturedSelection): PopoverHandle {
  const root = document.createElement('div')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Contextext result')
  root.tabIndex = -1
  root.style.cssText = [
    'position: absolute',
    'top: 0',
    'left: 0',
    'width: min(440px, calc(100vw - 24px))',
    'max-height: 70vh',
    'display: flex',
    'flex-direction: column',
    'border-radius: 12px',
    'background: rgb(255 255 255)',
    'color: rgb(23 23 23)',
    'box-shadow: 0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
    'opacity: 0',
    'transform: translate3d(0, -4px, 0)',
    'transition: opacity 140ms ease, transform 140ms ease',
    'font-size: 14px',
    'line-height: 1.55',
    'overflow: hidden',
  ].join(';')

  const isDark = parent.dataset.theme === 'dark'
  if (isDark) {
    root.style.background = 'rgb(23 23 23)'
    root.style.color = 'rgb(245 245 245)'
    root.style.boxShadow = '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)'
  }

  const header = document.createElement('div')
  header.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:8px',
    'padding: 12px 14px 6px',
    'flex: 0 0 auto',
  ].join(';')
  const title = document.createElement('div')
  title.textContent = 'Contextext'
  title.style.cssText = 'font-weight:600; font-size:12px; opacity:0.7; letter-spacing:0.02em;'

  const headerActions = document.createElement('div')
  headerActions.style.cssText = 'display:flex; align-items:center; gap:4px;'

  const sidePanelBtn = iconButton('⇲', 'Open in side panel', isDark)
  sidePanelBtn.style.display = 'none'

  const close = iconButton('✕', 'Close', isDark)

  headerActions.append(sidePanelBtn, close)
  header.append(title, headerActions)

  const status = document.createElement('div')
  status.style.cssText =
    'font-size:11px; opacity:0.65; padding: 0 14px 6px; display:none; flex: 0 0 auto;'

  const scroller = document.createElement('div')
  scroller.style.cssText = 'overflow:auto; padding: 0 14px 12px; flex: 1 1 auto; min-height: 40px;'

  const body = document.createElement('div')
  body.className = 'ctx-md'
  body.setAttribute('aria-live', 'polite')
  body.setAttribute('aria-busy', 'false')
  scroller.appendChild(body)

  const followUp = document.createElement('form')
  followUp.style.cssText = [
    'display:none',
    'gap:6px',
    'padding: 8px 10px 10px',
    'border-top: 1px solid rgba(0,0,0,0.08)',
    'flex: 0 0 auto',
  ].join(';')
  if (isDark) followUp.style.borderTopColor = 'rgba(255,255,255,0.08)'

  const followUpInput = document.createElement('input')
  followUpInput.type = 'text'
  followUpInput.placeholder = 'Ask a follow-up…'
  followUpInput.setAttribute('aria-label', 'Follow-up prompt')
  followUpInput.style.cssText = [
    'flex: 1 1 auto',
    'min-width: 0',
    'padding: 8px 10px',
    'border-radius: 8px',
    'border: 1px solid rgba(0,0,0,0.12)',
    'background: transparent',
    'color: inherit',
    'font: inherit',
    'font-size: 13px',
    'outline: none',
  ].join(';')
  if (isDark) followUpInput.style.borderColor = 'rgba(255,255,255,0.15)'
  followUpInput.addEventListener('focus', () => {
    followUpInput.style.borderColor = isDark ? 'rgba(96,165,250,0.7)' : 'rgba(37,99,235,0.7)'
  })
  followUpInput.addEventListener('blur', () => {
    followUpInput.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
  })

  const followUpSubmit = document.createElement('button')
  followUpSubmit.type = 'submit'
  followUpSubmit.textContent = 'Send'
  followUpSubmit.style.cssText = [
    'all: unset',
    'cursor: pointer',
    'padding: 8px 12px',
    'border-radius: 8px',
    'background: rgb(23 23 23)',
    'color: rgb(250 250 250)',
    'font-size: 13px',
    'font-weight: 600',
  ].join(';')
  if (isDark) {
    followUpSubmit.style.background = 'rgb(245 245 245)'
    followUpSubmit.style.color = 'rgb(23 23 23)'
  }

  followUp.append(followUpInput, followUpSubmit)

  root.append(header, status, scroller, followUp)
  parent.appendChild(root)

  const reference = createVirtualReference(selection)
  const update = () => {
    computePosition(reference, root, {
      strategy: 'fixed',
      placement: 'bottom',
      middleware: [inline(), offset(12), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      root.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
      root.style.opacity = '1'
    })
  }

  const cleanupPosition = autoUpdate(reference, root, update, { animationFrame: true })

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // do not steal Escape from the follow-up input if user is mid-typing
      if (document.activeElement === followUpInput && followUpInput.value) {
        followUpInput.value = ''
        return
      }
      destroy()
    }
  }
  document.addEventListener('keydown', onKey, true)

  let onDestroyCb: (() => void) | null = null
  let onFollowUpCb: ((prompt: string) => void) | null = null
  let onOpenSidePanelCb: (() => void) | null = null
  let buffer = ''
  let renderScheduled = false
  let isStreaming = false

  const flushRender = () => {
    renderScheduled = false
    body.innerHTML = renderMarkdown(buffer)
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60
    if (nearBottom) scroller.scrollTop = scroller.scrollHeight
  }

  const scheduleRender = () => {
    if (renderScheduled) return
    renderScheduled = true
    requestAnimationFrame(flushRender)
  }

  const destroy = () => {
    document.removeEventListener('keydown', onKey, true)
    cleanupPosition()
    root.remove()
    if (onDestroyCb) {
      const cb = onDestroyCb
      onDestroyCb = null
      cb()
    }
  }

  close.addEventListener('click', destroy)

  sidePanelBtn.addEventListener('click', () => {
    if (onOpenSidePanelCb) onOpenSidePanelCb()
  })

  followUp.addEventListener('submit', (e) => {
    e.preventDefault()
    const value = followUpInput.value.trim()
    if (!value || !onFollowUpCb) return
    followUpInput.value = ''
    onFollowUpCb(value)
  })

  requestAnimationFrame(() => root.focus({ preventScroll: true }))

  return {
    destroy,
    setBody: (text) => {
      buffer = text
      scheduleRender()
    },
    appendBody: (chunk) => {
      buffer += chunk
      scheduleRender()
    },
    setError: (text) => {
      buffer = ''
      body.textContent = text
      body.style.color = isDark ? 'rgb(252 165 165)' : 'rgb(185 28 28)'
      isStreaming = false
      body.setAttribute('aria-busy', 'false')
    },
    setStatus: (text) => {
      if (text) {
        status.textContent = text
        status.style.display = 'block'
      } else {
        status.textContent = ''
        status.style.display = 'none'
      }
    },
    setOnDestroy: (cb) => {
      onDestroyCb = cb
    },
    setOnFollowUp: (cb) => {
      onFollowUpCb = cb
    },
    setOnOpenSidePanel: (cb) => {
      onOpenSidePanelCb = cb
      sidePanelBtn.style.display = cb ? 'inline-flex' : 'none'
    },
    setStreaming: (streaming) => {
      isStreaming = streaming
      body.setAttribute('aria-busy', streaming ? 'true' : 'false')
      if (!streaming && renderScheduled) {
        requestAnimationFrame(flushRender)
      }
      if (!streaming) {
        followUp.style.display = onFollowUpCb ? 'flex' : 'none'
      }
    },
    showFollowUpInput: () => {
      if (!onFollowUpCb) return
      followUp.style.display = 'flex'
      if (!isStreaming) followUpInput.focus()
    },
  }
}

function iconButton(label: string, ariaLabel: string, isDark: boolean): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.setAttribute('aria-label', ariaLabel)
  btn.title = ariaLabel
  btn.textContent = label
  btn.style.cssText = [
    'all: unset',
    'cursor: pointer',
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'min-width: 22px',
    'height: 22px',
    'padding: 0 6px',
    'border-radius: 6px',
    'opacity: 0.6',
    'font-size: 12px',
    'transition: opacity 100ms ease, background 100ms ease',
  ].join(';')
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1'
    btn.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '0.6'
    btn.style.background = 'transparent'
  })
  return btn
}

function createVirtualReference(selection: CapturedSelection) {
  return {
    getBoundingClientRect: () => {
      try {
        const rect = selection.range.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return selection.rect
        return rect
      } catch {
        return selection.rect
      }
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
