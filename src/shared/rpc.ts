import type { Provider } from './schema'

export type RpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function rpc<T = unknown>(message: unknown): Promise<RpcResult<T>> {
  try {
    const res = (await chrome.runtime.sendMessage(message)) as RpcResult<T> | undefined
    if (!res) return { ok: false, error: 'No response from background' }
    return res
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function testConnection(
  provider: Pick<Provider, 'kind' | 'baseUrl'>,
  apiKey: string,
): Promise<RpcResult<{ ok: true; models?: string[] } | { ok: false; error: string }>> {
  return rpc({ type: 'test-connection', provider, apiKey })
}

export function openSettings() {
  return rpc({ type: 'open-settings' })
}

export function openOnboarding() {
  return rpc({ type: 'open-onboarding' })
}

export function openSidePanel(payload?: { title?: string; markdown?: string }) {
  return rpc({ type: 'open-side-panel', payload })
}
