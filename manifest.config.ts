import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

const isFirefox = process.env.BROWSER_TARGET === 'firefox'

/**
 * Manifest V3.
 *
 * Permission rationale (kept minimal on purpose):
 * - storage          → save settings (sync) and API keys (local-only)
 * - activeTab        → access the page the user is on, only when they invoke us
 * - scripting        → inject the content script when needed
 * - contextMenus     → right-click fallback trigger (resilience)
 * - sidePanel        → optional surface for long answers (Chrome only)
 *
 * Host permissions:
 * - <all_urls> for content script injection (the FAB needs to render anywhere)
 * - Provider hosts are requested DYNAMICALLY via chrome.permissions.request()
 *   when the user adds a custom OpenAI-compatible endpoint, so the install
 *   prompt stays narrow.
 */
export default defineManifest(() => ({
  manifest_version: 3,
  name: 'Owlet',
  short_name: 'Owlet',
  version: pkg.version,
  description: pkg.description,

  action: {
    default_title: 'Owlet — open settings',
    default_icon: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },

  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },

  background: isFirefox
    ? { scripts: ['src/background/index.ts'], type: 'module' }
    : { service_worker: 'src/background/index.ts', type: 'module' },

  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: true,
      match_about_blank: false,
    },
  ],

  options_ui: {
    page: 'src/settings/index.html',
    open_in_tab: true,
  },

  web_accessible_resources: [
    {
      resources: ['src/onboarding/index.html', 'icons/*', 'assets/*.woff2'],
      matches: ['<all_urls>'],
    },
  ],

  permissions: [
    'storage',
    'activeTab',
    'scripting',
    'contextMenus',
    ...(isFirefox ? [] : ['sidePanel']),
  ],

  host_permissions: ['<all_urls>'],

  commands: {
    'trigger-default-action': {
      suggested_key: {
        default: 'Ctrl+Shift+E',
        mac: 'Command+Shift+E',
      },
      description: 'Run Owlet on the current selection',
    },
  },

  ...(isFirefox
    ? {}
    : {
        side_panel: { default_path: 'src/sidepanel/index.html' },
      }),

  ...(isFirefox
    ? {
        browser_specific_settings: {
          gecko: {
            id: 'owlet@owletapp.dev',
            strict_min_version: '128.0',
            data_collection_permissions: {
              required: ['none'],
            },
          },
        },
      }
    : {}),
}))
