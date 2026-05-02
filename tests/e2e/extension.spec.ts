import { expect, test } from './fixture'
import { mockLlm, seedConfig, selectText, selectTextarea, shadowMount } from './helpers'

const SAMPLE_URL = 'http://127.0.0.1:4242/sample.html'

test.beforeEach(async ({ context, extensionId }) => {
  await mockLlm(context)
  await seedConfig(context, extensionId)
})

test('selecting text shows the FAB', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(SAMPLE_URL)
  await selectText(page, '#p1')

  const fab = page.locator('button[aria-label="Open Owlet"]')
  await expect(fab).toHaveCount(1)

  const fontFamily = await fab.evaluate((el) => getComputedStyle(el).fontFamily)
  expect(fontFamily).toMatch(/Euclid Circular B/)
})

test('clicking FAB opens popover and streams a response', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(SAMPLE_URL)
  await selectText(page, '#p1')

  const mount = shadowMount(page)
  await mount.locator('button[aria-label="Open Owlet"]').click()

  const dialog = mount.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()

  const body = dialog.locator('.ctx-md')
  await expect(body).toContainText('Mocked')
  await expect(body.locator('strong')).toContainText('markdown')
})

test('FAB chevron opens action menu and picks a non-default action', async ({ context }) => {
  const page = await context.newPage()
  await mockLlm(context, { reply: 'Summary content here.' })
  await page.goto(SAMPLE_URL)
  await selectText(page, '#p1')

  const mount = shadowMount(page)
  await mount.locator('button[aria-label="Choose action"]').click()

  const menu = mount.locator('[role="menu"]')
  await expect(menu).toBeVisible()
  await menu.locator('[role="menuitem"]', { hasText: 'Summarize' }).click()

  const dialog = mount.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.ctx-md')).toContainText('Summary content here.')
})

test('follow-up input sends a second prompt', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(SAMPLE_URL)
  await selectText(page, '#p1')

  const mount = shadowMount(page)
  await mount.locator('button[aria-label="Open Owlet"]').click()

  const dialog = mount.locator('[role="dialog"]')
  await expect(dialog.locator('.ctx-md')).toContainText('Mocked')

  await mockLlm(context, { reply: 'Follow-up answer text.' })

  const input = dialog.locator('input[aria-label="Follow-up prompt"]')
  await expect(input).toBeVisible()
  await input.fill('what does this mean?')
  await input.press('Enter')

  await expect(dialog.locator('.ctx-md')).toContainText('Follow-up answer text.')
})

test('Escape key closes the popover', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(SAMPLE_URL)
  await selectText(page, '#p1')

  const mount = shadowMount(page)
  await mount.locator('button[aria-label="Open Owlet"]').click()

  const dialog = mount.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('FAB reappears after closing the popover and re-selecting text', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(SAMPLE_URL)
  await selectText(page, '#p1')

  const mount = shadowMount(page)
  const fab = mount.locator('button[aria-label="Open Owlet"]')
  await expect(fab).toBeVisible()
  await fab.click()

  const dialog = mount.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()

  await selectText(page, '#p2')
  await expect(fab).toBeVisible()
})

test('FAB slides between selections instead of re-mounting', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(SAMPLE_URL)
  await selectText(page, '#p1')

  const mount = shadowMount(page)
  const fab = mount.locator('button[aria-label="Open Owlet"]')
  await expect(fab).toBeVisible()

  const tag = await fab.evaluate((el) => {
    const e = el as HTMLElement & { __owletProbe?: number }
    e.__owletProbe = Date.now()
    return e.__owletProbe
  })

  await selectText(page, '#p2')
  await expect(fab).toBeVisible()
  const tagAfter = await fab.evaluate(
    (el) => (el as HTMLElement & { __owletProbe?: number }).__owletProbe,
  )
  expect(tagAfter).toBe(tag)
})

test('selection inside a textarea also shows the FAB', async ({ context }) => {
  const page = await context.newPage()
  await page.goto(SAMPLE_URL)

  await selectTextarea(page, '#ta')

  const fab = shadowMount(page).locator('button[aria-label="Open Owlet"]')
  await expect(fab).toBeVisible()
})
