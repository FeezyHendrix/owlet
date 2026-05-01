import { openSidePanel } from '@shared/rpc'
import type { Action, Provider } from '@shared/schema'
import { loadConfig } from '@shared/storage'
import { type FabHandle, showFab } from './fab'
import { type PopoverHandle, showPopover } from './popover'
import { type RunHandle, runAction } from './run-action'
import { type CapturedSelection, captureSelection } from './selection'
import { ensureShadowHost } from './shadow-host'

if (!window.__OWLET_LOADED__) {
  window.__OWLET_LOADED__ = true
  initContentScript()
}

declare global {
  interface Window {
    __OWLET_LOADED__?: boolean
  }
}

function initContentScript() {
  let fab: FabHandle | null = null
  let popover: PopoverHandle | null = null
  let selectionDebounce: ReturnType<typeof setTimeout> | null = null

  const onSelectionChange = () => {
    if (selectionDebounce) clearTimeout(selectionDebounce)
    selectionDebounce = setTimeout(handleSelectionChange, 150)
  }

  const handleSelectionChange = async () => {
    if (popover) return
    const selection = captureSelection()
    if (!selection) {
      fab?.destroy()
      fab = null
      return
    }

    const config = await loadConfig().catch(() => null)
    const actions = config?.actions ?? []
    const defaultActionId = config?.defaultActionId ?? null

    const mount = ensureShadowHost().mountPoint
    fab?.destroy()
    fab = showFab(
      mount,
      selection,
      () => {
        const fresh = captureSelection() ?? selection
        fab?.destroy()
        fab = null
        openPopoverAndRun(mount, fresh, null)
      },
      {
        actions,
        defaultActionId,
        onPickAction: (action) => {
          const fresh = captureSelection() ?? selection
          fab?.destroy()
          fab = null
          openPopoverAndRun(mount, fresh, action)
        },
      },
    )
  }

  const openPopoverAndRun = (
    mount: HTMLElement,
    selection: CapturedSelection,
    forcedAction: Action | null,
  ) => {
    popover?.destroy()
    const handle = showPopover(mount, selection)
    popover = handle
    handle.setOnDestroy(() => {
      popover = null
    })

    runActionFlow(selection, handle, forcedAction).catch((err) => {
      handle.setError(err instanceof Error ? err.message : String(err))
    })
  }

  document.addEventListener('selectionchange', onSelectionChange)

  chrome.runtime?.onMessage.addListener((msg) => {
    if (msg?.type === 'ping') return { pong: true, location: location.href }
  })
}

async function runActionFlow(
  selection: CapturedSelection,
  popover: PopoverHandle,
  forcedAction: Action | null,
) {
  const config = await loadConfig()

  if (config.providers.length === 0) {
    popover.setBody(
      'Welcome to Owlet.\n\nYou need to add an LLM provider before you can run actions.\n\nClick the extension icon to open settings.',
    )
    return
  }

  const action = forcedAction ?? pickAction(config.actions, config.defaultActionId)
  if (!action) {
    popover.setBody('No action configured.\n\nOpen settings (click the extension icon) to add one.')
    return
  }

  const provider = config.providers.find((p) => p.id === action.providerId)
  if (!provider) {
    popover.setError(
      `The default action references a provider ("${action.providerId}") that no longer exists.\n\nOpen settings to fix this.`,
    )
    return
  }

  await streamInto(popover, selection, action, provider)
}

async function streamInto(
  popover: PopoverHandle,
  selection: CapturedSelection,
  action: Action,
  provider: Provider,
) {
  popover.setStatus(`${action.icon} ${action.name} · ${action.model || provider.defaultModel}`)
  popover.setBody('')
  popover.setStreaming(true)

  let buffer = ''
  let firstChunk = true
  let runHandle: RunHandle | null = null
  let finished = false

  popover.setOnOpenSidePanel(() => {
    if (!chrome.sidePanel) return
    openSidePanel({
      title: `${action.icon} ${action.name}`,
      markdown: buffer,
    })
  })

  popover.setOnFollowUp((prompt) => {
    if (!finished) return
    const followUp: Action = {
      ...action,
      id: `${action.id}.followup`,
      name: 'Follow-up',
      systemPrompt: action.systemPrompt,
      userPromptTemplate: buildFollowUpTemplate(buffer, prompt),
      contextScope: 'selection',
    }
    streamInto(popover, selection, followUp, provider).catch((err) => {
      popover.setError(err instanceof Error ? err.message : String(err))
    })
  })

  runHandle = await runAction(selection, action, provider, {
    onText: (delta) => {
      if (firstChunk) {
        firstChunk = false
        popover.setBody('')
      }
      buffer += delta
      popover.appendBody(delta)
    },
    onDone: () => {
      finished = true
      popover.setStreaming(false)
      if (firstChunk) popover.setBody('(empty response)')
    },
    onError: (message) => {
      finished = true
      popover.setStreaming(false)
      popover.setError(`Error: ${message}`)
    },
    onTrimmedNotice: (notice) => {
      popover.setStatus(
        `${action.icon} ${action.name} · ${action.model || provider.defaultModel} · ${notice}`,
      )
    },
  })

  popover.setOnDestroy(() => {
    runHandle?.abort()
  })
}

function buildFollowUpTemplate(previousAnswer: string, userQuestion: string): string {
  return [
    'Original selection:',
    '"""',
    '{{selection}}',
    '"""',
    '',
    'Your previous answer:',
    '"""',
    previousAnswer,
    '"""',
    '',
    'Follow-up question:',
    userQuestion,
  ].join('\n')
}

function pickAction(actions: Action[], defaultId: string | null): Action | null {
  if (defaultId) {
    const found = actions.find((a) => a.id === defaultId)
    if (found) return found
  }
  return actions[0] ?? null
}
