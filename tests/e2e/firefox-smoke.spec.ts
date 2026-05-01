import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIREFOX_DIST = path.resolve(__dirname, '../../dist-firefox')

test.describe('Firefox build smoke', () => {
  test('dist-firefox manifest is a valid Firefox MV3 manifest', async () => {
    const manifestPath = path.join(FIREFOX_DIST, 'manifest.json')
    expect(fs.existsSync(manifestPath), 'run pnpm build:firefox first').toBe(true)
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    expect(manifest.manifest_version).toBe(3)
    expect(manifest.name).toBe('Owlet')
    expect(manifest.background?.scripts?.[0]).toBeTruthy()
    expect(manifest.browser_specific_settings?.gecko?.id).toBeTruthy()
    expect(manifest.permissions).not.toContain('sidePanel')
    expect(manifest.side_panel).toBeUndefined()
    expect(manifest.content_scripts?.[0]?.matches).toContain('<all_urls>')
  })

  test('Firefox build emits content + background bundles', async () => {
    expect(fs.existsSync(path.join(FIREFOX_DIST, 'manifest.json'))).toBe(true)
    const manifest = JSON.parse(fs.readFileSync(path.join(FIREFOX_DIST, 'manifest.json'), 'utf8'))
    const bgScript = manifest.background.scripts[0]
    expect(fs.existsSync(path.join(FIREFOX_DIST, bgScript))).toBe(true)
    const csScript = manifest.content_scripts[0].js[0]
    expect(fs.existsSync(path.join(FIREFOX_DIST, csScript))).toBe(true)
  })
})
