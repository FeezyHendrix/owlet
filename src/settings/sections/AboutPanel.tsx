import { openOnboarding } from '@shared/rpc'
import { SectionHeader } from '../components/SectionHeader'

const VERSION =
  typeof chrome !== 'undefined' && chrome.runtime?.getManifest
    ? chrome.runtime.getManifest().version
    : 'dev'

const REPO_URL = 'https://github.com/FeezyHendrix/owlet'

export function AboutPanel() {
  return (
    <div>
      <SectionHeader title="About" description="Open source. Bring-your-own-key. No telemetry." />

      <div class="space-y-4">
        <div class="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex items-baseline gap-3">
            <span class="text-2xl" aria-hidden="true">
              ✦
            </span>
            <div>
              <div class="text-base font-semibold">Owlet</div>
              <div class="text-xs text-neutral-500">Version {VERSION}</div>
            </div>
          </div>
          <p class="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            Highlight any text on the web. Get instant context from your own LLM provider.
          </p>
        </div>

        <Row label="Source code">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            class="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            github.com/FeezyHendrix/owlet →
          </a>
        </Row>

        <Row label="Privacy">
          <p class="text-sm text-neutral-700 dark:text-neutral-300">
            Your API keys never leave this device. Your selections only ever go to the provider you
            configured. No analytics. No accounts.
          </p>
        </Row>

        <Row label="Onboarding">
          <button
            type="button"
            onClick={() => openOnboarding()}
            class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:border-neutral-500 dark:border-neutral-700"
          >
            Re-run onboarding
          </button>
        </Row>

        <Row label="License">
          <p class="text-sm text-neutral-700 dark:text-neutral-300">MIT</p>
        </Row>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <div class="grid grid-cols-[120px_1fr] gap-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="text-xs font-medium text-neutral-500">{label}</div>
      <div>{children}</div>
    </div>
  )
}
