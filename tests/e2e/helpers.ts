import type { BrowserContext, Page } from '@playwright/test'

const MOCK_BASE = 'http://127.0.0.1:4242/v1'
const MOCK_API_KEY = 'sk-test-fake-key'

export async function seedConfig(context: BrowserContext, extensionId: string): Promise<void> {
  const optionsUrl = `chrome-extension://${extensionId}/src/settings/index.html`
  const page = await context.newPage()
  await page.goto(optionsUrl)
  await page.evaluate(
    async ({ baseUrl, apiKey }) => {
      const provider = {
        id: 'p_test',
        label: 'Mock',
        kind: 'openai-compatible',
        baseUrl,
        apiKeyRef: 'p_test',
        defaultModel: 'mock-model',
      }
      const action = {
        id: 'a_explain',
        name: 'Explain',
        icon: '💡',
        systemPrompt: 'You are helpful.',
        userPromptTemplate: 'Explain: {{selection}}',
        contextScope: 'selection',
        providerId: 'p_test',
      }
      const action2 = {
        id: 'a_summarize',
        name: 'Summarize',
        icon: '📝',
        systemPrompt: '',
        userPromptTemplate: 'Summarize: {{selection}}',
        contextScope: 'selection',
        providerId: 'p_test',
      }
      const config = {
        version: 1,
        providers: [provider],
        actions: [action, action2],
        defaultActionId: 'a_explain',
        ui: {
          theme: 'auto',
          fabEnabled: true,
          hotkey: 'Ctrl+Shift+E',
          minSelectionChars: 3,
          maxSelectionChars: 20000,
        },
        siteRules: [],
      }
      await chrome.storage.sync.set({ 'owlet.config.v1': config })
      await chrome.storage.local.set({ 'owlet.key.p_test': apiKey })
    },
    { baseUrl: MOCK_BASE, apiKey: MOCK_API_KEY },
  )
  await page.close()
}

// Programs the mock server with the next streamed reply. The mock server
// (tests/e2e/mock-server.mjs) is what the extension's background SW actually
// fetches — `context.route` does not intercept service-worker requests.
export async function mockLlm(
  _context: BrowserContext,
  options: { reply?: string; chunks?: string[] } = {},
): Promise<void> {
  const body: Record<string, unknown> = {
    reply: options.reply ?? 'Mocked **markdown** response.',
  }
  if (options.chunks != null) body.chunks = options.chunks
  const res = await fetch('http://127.0.0.1:4242/__mock/next', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`mockLlm config failed: ${res.status}`)
}

export async function selectText(page: Page, selector: string): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  // Content script loads at document_idle; give it a beat before we try to drive selection.
  await page.waitForTimeout(400)
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`No element matches ${sel}`)
    const range = document.createRange()
    range.selectNodeContents(el)
    const s = window.getSelection()
    if (!s) throw new Error('No window selection available')
    s.removeAllRanges()
    s.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }, selector)
  // captureSelection runs on a 150ms debounce.
  await page.waitForTimeout(300)
}

export async function selectTextarea(page: Page, selector: string): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(400)
  await page.evaluate((sel) => {
    const ta = document.querySelector(sel) as HTMLTextAreaElement | null
    if (!ta) throw new Error(`No textarea matches ${sel}`)
    ta.focus()
    ta.setSelectionRange(0, ta.value.length)
    // Fire on both document and the textarea — Chrome only fires `selectionchange`
    // on document for *DOM* selections, not for textarea internal selections.
    document.dispatchEvent(new Event('selectionchange'))
    ta.dispatchEvent(new Event('select', { bubbles: true }))
  }, selector)
  await page.waitForTimeout(300)
}

// Playwright auto-pierces open shadow roots in CSS selectors, so callers can
// query elements inside our shadow host directly via `page.locator(...)`.
// This shim exists so tests stay readable + so we have a single seam if we
// ever need to point queries at a specific shadow host.
export function shadowMount(page: Page) {
  return page
}
