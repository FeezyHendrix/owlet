import shadowCss from './shadow.css?inline'

const HOST_ID = 'contextext-shadow-host'

export type ShadowMount = {
  shadowRoot: ShadowRoot
  mountPoint: HTMLElement
  destroy: () => void
}

export function ensureShadowHost(): ShadowMount {
  const existing = document.getElementById(HOST_ID)
  if (existing?.shadowRoot) {
    const mount = existing.shadowRoot.getElementById('mount')
    if (mount instanceof HTMLElement) {
      return {
        shadowRoot: existing.shadowRoot,
        mountPoint: mount,
        destroy: () => existing.remove(),
      }
    }
  }

  const host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 0',
    'height: 0',
    'z-index: 2147483647',
    'pointer-events: none',
  ].join(';')

  const root = host.attachShadow({ mode: 'open' })
  applyStyles(root)

  const mount = document.createElement('div')
  mount.id = 'mount'
  mount.dataset.theme = prefersDark() ? 'dark' : 'light'
  root.appendChild(mount)

  document.documentElement.appendChild(host)

  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const themeListener = (e: MediaQueryListEvent) => {
    mount.dataset.theme = e.matches ? 'dark' : 'light'
  }
  mql.addEventListener('change', themeListener)

  return {
    shadowRoot: root,
    mountPoint: mount,
    destroy: () => {
      mql.removeEventListener('change', themeListener)
      host.remove()
    },
  }
}

function applyStyles(root: ShadowRoot): void {
  if ('adoptedStyleSheets' in root && typeof CSSStyleSheet !== 'undefined') {
    try {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(shadowCss)
      root.adoptedStyleSheets = [sheet]
      return
    } catch {
      // fall through to <style> injection
    }
  }
  const style = document.createElement('style')
  style.textContent = shadowCss
  root.appendChild(style)
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
