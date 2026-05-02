# Owlet

> Highlight any text on the web. Get instant context from your own LLM.

A privacy-first, bring-your-own-key Chrome and Firefox extension. Select text on any page → press the floating ✦ button → stream a response from **your** LLM into a popover.

No accounts. No telemetry. Your API key never leaves your device.

## Features

- **Highlight → Get context** — select text, click the FAB, get streamed answers inline.
- **Bring your own key** — works with OpenAI, Anthropic, and any OpenAI-compatible endpoint:
  Kimi, Groq, OpenRouter, Together, NVIDIA, Ollama, LM Studio, vLLM, etc.
- **Built-in actions** — Explain, Summarize, Translate, Define. Add your own with custom prompts.
- **Action menu** — chevron next to the FAB picks a non-default action without opening settings.
- **Follow-up prompts** — keep the conversation going from inside the popover.
- **Side panel handoff** — long answers can pop out into Chrome's side panel.
- **Markdown rendering** — sanitized via DOMPurify; safe on hostile pages.
- **Shadow DOM** — UI is fully isolated from page styles and scripts.
- **Streaming** — SSE / `ReadableStream`, with first-token feedback under 200ms.
- **Smart context** — selection, surrounding paragraph, or full page (Readability extraction).
- **Keyboard hotkey** — `Ctrl/Cmd + Shift + E` runs the default action on the current selection.
- **Onboarding** — 3-step skippable setup with an interactive sample paragraph.
- **Settings** — auto-saves with a "Saved" indicator, no Apply button.

## Privacy

- API keys live in `chrome.storage.local` and never leave the device.
- Settings live in `chrome.storage.sync` so they follow your browser profile, but **never include keys**.
- Selections are sent only to the LLM provider you configured. Nothing else.
- No telemetry. No analytics. No accounts.

## Install (development)

Requirements: Node ≥ 20, pnpm ≥ 10.

```bash
pnpm install
pnpm dev              # Chrome MV3 build with HMR → load `dist/`
pnpm dev:firefox      # Firefox MV3 build → load `dist-firefox/`
```

Then load the unpacked extension:

- **Chrome / Edge / Brave / Arc**: `chrome://extensions` → Developer mode → Load unpacked → pick `dist/`
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `dist-firefox/manifest.json`

The onboarding tab opens automatically on first install.

## Architecture

```
src/
  background/      MV3 service worker · LLM adapters (OpenAI, Anthropic) · streaming Port
  content/         Selection capture · FAB · popover · Readability extraction · run-action orchestrator
  settings/        Preact settings UI (providers, actions, hotkey, theme, site rules)
  onboarding/      3-step Preact onboarding flow
  sidepanel/       Long-answer side panel (Chrome only)
  shared/          Zod schema · storage · templates · token trimming · RPC
  ui/              Shared CSS (Tailwind v4 + markdown styles)
```

- **MV3** with branched manifest for Chrome/Firefox (see `manifest.config.ts`).
- **Streaming** flows through a long-lived `chrome.runtime.Port` from content → background.
- **Token budget** trims context to 80k chars before sending; popover shows a "trimmed" notice.
- **Open Shadow DOM** isolates injected UI from the host page; works on strict-CSP sites.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Chrome dev build with HMR |
| `pnpm dev:firefox` | Firefox dev build |
| `pnpm build` | Production Chrome build → `dist/` |
| `pnpm build:firefox` | Production Firefox build → `dist-firefox/` |
| `pnpm build:all` | Both production builds |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | Biome check |
| `pnpm lint:fix` | Biome check + auto-fix |
| `pnpm test` | Vitest unit tests (28 tests) |
| `pnpm test:e2e` | Playwright E2E with the extension loaded (8 tests) |
| `pnpm package` | Build + zip Chrome bundle for Web Store upload |
| `pnpm package:firefox` | Build + zip Firefox bundle for AMO upload |

## Testing

- **Unit** — Vitest, Happy DOM. Covers schema validation, SSE parser, OpenAI adapter, selection capture, template rendering.
- **E2E** — Playwright drives a real Chromium with the unpacked extension loaded. A small Node SSE mock server (`tests/e2e/mock-server.mjs`) stands in for the LLM provider, because Playwright's `context.route` does not intercept MV3 service-worker fetches.
- **Firefox smoke** — verifies the Firefox build emits a valid Gecko-flavored MV3 manifest and the bundles it references.

## Tech

- **Build**: Vite 6 + `@crxjs/vite-plugin` (MV3 HMR)
- **UI**: Preact + Tailwind v4
- **Validation**: Zod
- **Markdown**: marked + DOMPurify
- **Positioning**: Floating UI
- **Lint/format**: Biome
- **Tests**: Vitest + Playwright

## License

[MIT](./LICENSE)
