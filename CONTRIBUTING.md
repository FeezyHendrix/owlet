# Contributing to Owlet

Thanks for considering a contribution. Owlet is a privacy-first, bring-your-own-key Chrome & Firefox extension. The code is small, the gates are strict, and PRs that respect the bar below land fast.

## Quick start

```bash
pnpm install
pnpm dev              # Chrome  → load dist/
pnpm dev:firefox      # Firefox → load dist-firefox/
```

- Chrome: `chrome://extensions` → Developer mode → Load unpacked → `dist/`
- Firefox: `about:debugging` → Load Temporary Add-on → `dist-firefox/manifest.json`

Reload the extension after every rebuild.

## Project layout

| Path | Purpose |
|---|---|
| `src/background/` | MV3 service worker, side-panel handoff, streaming protocol |
| `src/content/` | Content script: FAB, popover (Shadow DOM), action runner |
| `src/sidepanel/` | Multi-conversation chat UI (Preact) |
| `src/settings/` | Settings page (providers, actions, advanced) |
| `src/onboarding/` | First-run flow |
| `src/shared/` | Schema (Zod), storage, templates, conversations, defaults |
| `tests/unit/` | Vitest + happy-dom |
| `tests/e2e/` | Playwright (Chrome + Firefox smoke) |

## The gate (must pass before every PR)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm build:firefox && pnpm test:e2e
```

CI runs the same gate. Red CI = no merge.

## Conventions

- **TypeScript strict.** No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- **Biome** for lint + format. Run `pnpm lint:fix` before pushing.
- **Atomic commits.** One fix or feature per commit. Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- **Comments are landmines.** Only add a comment if it encodes a non-obvious invariant, security constraint, perf trick, regex meaning, or platform quirk. Self-documenting code beats commentary.
- **Schema changes are migrations.** Adding a field? Give it a Zod `.default(...)` so existing stored configs auto-migrate. Removing a field? Write a one-shot migration in `src/shared/storage.ts`.

## Known landmines (do not "clean up")

- `chrome.sidePanel.open()` MUST be called synchronously inside the message listener. The current background handler preserves this — don't refactor it into an async chain.
- Asset URLs inside the content-script Shadow DOM MUST go through `chrome.runtime.getURL()`. Vite `?url` imports return `/assets/...` which resolves against the host page's origin and 404s.
- The side-panel layout requires `h-screen overflow-hidden` on `html`, `body`, `#root`, **and** `min-h-0` on every `flex-1` scroller. Without both, the composer drifts off-screen.

## Testing

- **Unit**: Vitest with happy-dom. Co-locate tests as `*.test.ts` or place in `tests/unit/`.
- **E2E**: Playwright launches Chromium with the extension loaded. Add scenarios to `tests/e2e/extension.spec.ts`.
- Mock `chrome.*` per-test (see `tests/unit/storage-migration.test.ts` for the pattern).

## Pull request checklist

- [ ] Full local gate green (`typecheck && lint && test && build && build:firefox && test:e2e`)
- [ ] One logical change per commit
- [ ] No new comments unless they encode a real invariant
- [ ] Schema changes have a default value or a migration
- [ ] Manual smoke: load `dist/`, exercise the changed surface

## Reporting bugs

Open an issue with:

- Browser + version
- Provider you're using (OpenAI / Anthropic / OpenAI-compatible URL)
- Steps to reproduce
- Console output from the extension's service worker AND the page (DevTools → Console)

Never paste API keys.

## License

By contributing you agree your work is licensed under the [MIT License](./LICENSE).
