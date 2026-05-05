#!/usr/bin/env node
// Rasterize the Owlet eye-mark to PNG at the four sizes Chrome expects in
// public/icons/. Source SVG is 271x132; we wrap it in a square viewBox so the
// mark is centered with consistent margin at every size, then call rsvg-convert.
//
// Re-run manually whenever the source SVG changes:
//   node scripts/build-icons.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SOURCE = 'src/assets/logo/mark-dark.svg'
const OUT_DIR = 'public/icons'
const SIZES = [16, 32, 48, 128]
// Source viewBox: 271 wide x 132 tall. Pad to a 320x320 square for a tight
// but breathable margin, mark centered.
const PAD_W = 320
const PAD_H = 320

const src = readFileSync(SOURCE, 'utf8')
const innerMatch = src.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
if (!innerMatch) {
  console.error('Could not parse source SVG inner content.')
  process.exit(1)
}
const inner = innerMatch[1]

// Center the 271x132 source inside the 320x320 padded canvas.
const tx = (PAD_W - 271) / 2
const ty = (PAD_H - 132) / 2

const padded = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAD_W}" height="${PAD_H}" viewBox="0 0 ${PAD_W} ${PAD_H}" fill="none">
<g transform="translate(${tx} ${ty})">${inner}</g>
</svg>`

const tmpDir = join(tmpdir(), `owlet-icons-${Date.now()}`)
mkdirSync(tmpDir, { recursive: true })
const tmpSvg = join(tmpDir, 'padded.svg')
writeFileSync(tmpSvg, padded)
mkdirSync(OUT_DIR, { recursive: true })

for (const size of SIZES) {
  const out = join(OUT_DIR, `icon-${size}.png`)
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', out, tmpSvg], {
    stdio: 'inherit',
  })
  process.stdout.write(`wrote ${out}\n`)
}

rmSync(tmpDir, { recursive: true, force: true })
