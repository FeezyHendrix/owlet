import euclid400Url from '../assets/fonts/euclid-circular-b-400.woff2?url'
import euclid500Url from '../assets/fonts/euclid-circular-b-500.woff2?url'
import euclid600Url from '../assets/fonts/euclid-circular-b-600.woff2?url'
import euclid700Url from '../assets/fonts/euclid-circular-b-700.woff2?url'
import shadowCss from './shadow.css?inline'

const HOST_ID = 'owlet-shadow-host'

// LANDMINE: do NOT move these @font-face rules into shadow.css. That sheet is
// `?inline` and adopted via CSSStyleSheet.replaceSync, where url() resolves
// against the host page's base URL — fonts would silently 404. Build them at
// runtime with chrome.runtime.getURL(). The woff2 files must also be listed in
// web_accessible_resources (see manifest.config.ts).
const FONT_FACES: { weight: number; url: string }[] = [
  { weight: 400, url: euclid400Url },
  { weight: 500, url: euclid500Url },
  { weight: 600, url: euclid600Url },
  { weight: 700, url: euclid700Url },
]

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
  const fullCss = buildFontFaceCss() + shadowCss
  if ('adoptedStyleSheets' in root && typeof CSSStyleSheet !== 'undefined') {
    try {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(fullCss)
      root.adoptedStyleSheets = [sheet]
      return
    } catch {
      // fall through to <style> injection
    }
  }
  const style = document.createElement('style')
  style.textContent = fullCss
  root.appendChild(style)
}

function buildFontFaceCss(): string {
  const getUrl = (path: string) =>
    typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path
  return FONT_FACES.map(
    ({ weight, url }) =>
      `@font-face{font-family:"Euclid Circular B";font-style:normal;font-weight:${weight};font-display:swap;src:url("${getUrl(url)}") format("woff2");}`,
  ).join('\n')
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
