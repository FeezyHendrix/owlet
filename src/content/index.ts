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
  let fabHideTimer: ReturnType<typeof setTimeout> | null = null

  const onSelectionChange = () => {
    if (selectionDebounce) clearTimeout(selectionDebounce)
    selectionDebounce = setTimeout(handleSelectionChange, 150)
  }

  const cancelPendingHide = () => {
    if (fabHideTimer) {
      clearTimeout(fabHideTimer)
      fabHideTimer = null
    }
  }

  const handleSelectionChange = async () => {
    if (popover) return
    const selection = captureSelection()
    if (!selection) {
      // Selections often collapse for a frame mid-drag or when the user
      // adjusts the highlight. Defer destroy so the FAB can be reused
      // (and animated to its new spot) instead of replaying the enter
      // animation from offscreen on every transient gap.
      if (!fab || fabHideTimer) return
      fabHideTimer = setTimeout(() => {
        fabHideTimer = null
        if (captureSelection()) return
        fab?.destroy()
        fab = null
      }, 250)
      return
    }
    cancelPendingHide()

    const config = await loadConfig().catch(() => null)
    const actions = config?.actions ?? []
    const defaultActionId = config?.defaultActionId ?? null

    const mount = ensureShadowHost().mountPoint

    const onClick = () => {
      const fresh = captureSelection() ?? selection
      cancelPendingHide()
      fab?.destroy()
      fab = null
      openPopoverAndRun(mount, fresh, null)
    }
    const fabOptions = {
      actions,
      defaultActionId,
      onPickAction: (action: Action) => {
        const fresh = captureSelection() ?? selection
        cancelPendingHide()
        fab?.destroy()
        fab = null
        openPopoverAndRun(mount, fresh, action)
      },
    }

    if (fab?.update(selection, onClick, fabOptions)) return
    fab?.destroy()
    fab = showFab(mount, selection, onClick, fabOptions)
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
      // After closing, the page selection may still be intact but no
      // selectionchange will fire. Re-evaluate so the FAB reappears.
      handleSelectionChange()
    })

    runActionFlow(selection, handle, forcedAction).catch((err) => {
      handle.setError(err instanceof Error ? err.message : String(err))
    })
  }

  document.addEventListener('selectionchange', onSelectionChange)

  const teardown = () => {
    cancelPendingHide()
    if (selectionDebounce) {
      clearTimeout(selectionDebounce)
      selectionDebounce = null
    }
    popover?.destroy()
    popover = null
    fab?.destroy()
    fab = null
  }

  // Tear down on real navigation away from the document.
  window.addEventListener('pagehide', teardown)

  // SPA route changes don't fire pagehide. Wrap history methods + listen to
  // popstate so we tear down whenever location actually changes.
  let lastHref = location.href
  const onUrlChange = () => {
    if (location.href === lastHref) return
    lastHref = location.href
    teardown()
  }
  const wrap = (key: 'pushState' | 'replaceState') => {
    const original = history[key]
    history[key] = function (this: History, ...args: Parameters<typeof original>) {
      const result = original.apply(this, args)
      // Defer so the new URL is visible to listeners and our handler.
      queueMicrotask(onUrlChange)
      return result
    } as typeof original
  }
  wrap('pushState')
  wrap('replaceState')
  window.addEventListener('popstate', onUrlChange)

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
  popover.setStatus(`${action.name} · ${action.model || provider.defaultModel}`)
  popover.setBody('')
  popover.setStreaming(true)

  let buffer = ''
  let firstChunk = true
  let runHandle: RunHandle | null = null
  let finished = false

  popover.setOnOpenSidePanel(() => {
    if (!chrome.sidePanel) return
    openSidePanel({
      title: action.name,
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
      popover.setStatus(`${action.name} · ${action.model || provider.defaultModel} · ${notice}`)
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
