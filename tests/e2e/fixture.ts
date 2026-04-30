import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type BrowserContext, test as base, chromium } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = path.resolve(__dirname, '../../dist')

export type Fixtures = {
  context: BrowserContext
  extensionId: string
}

export const test = base.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature requires destructuring even when empty
  context: async ({}, use) => {
    const userDataDir = path.join(__dirname, '..', '..', '.playwright-userdata', `c${Date.now()}`)
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--no-sandbox',
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers()
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 })
    const url = worker.url()
    const id = url.match(/chrome-extension:\/\/([^/]+)/)?.[1]
    if (!id) throw new Error(`Could not parse extension id from ${url}`)
    await use(id)
  },
})

export const expect = test.expect
