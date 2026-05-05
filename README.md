<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/logo/lockup-light.svg">
    <img alt="Owlet" src="src/assets/logo/lockup-dark.svg" width="240">
  </picture>
</p>

<p align="center">
  <em>Highlight any text on the web. Get instant context from your own LLM.</em>
</p>

---

Privacy-first, bring-your-own-key Chrome & Firefox extension. Select text → ✦ → streamed answer in a popover. No accounts, no telemetry, key stays on device.

## Features

Highlight-to-answer FAB · multi-conversation side panel · OpenAI / Anthropic / any OpenAI-compatible endpoint (Kimi, Groq, OpenRouter, Ollama, …) · custom actions & prompts · `Ctrl/Cmd+Shift+E` hotkey · Shadow DOM isolation · streamed markdown (DOMPurify) · Readability-based page context · onboarding + auto-saving settings.

## Install (dev)

```bash
pnpm install
pnpm dev              # Chrome  → load dist/
pnpm dev:firefox      # Firefox → load dist-firefox/
```

- Chrome: `chrome://extensions` → Developer mode → Load unpacked → `dist/`
- Firefox: `about:debugging` → Load Temporary Add-on → `dist-firefox/manifest.json`

## Scripts

`pnpm build` · `pnpm build:firefox` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:e2e` · `pnpm package` / `package:firefox`

## Stack

Vite 6 + `@crxjs/vite-plugin` · Preact · Tailwind v4 · Zod · marked + DOMPurify · Floating UI · Biome · Vitest + Playwright.

## License

[MIT](./LICENSE)
