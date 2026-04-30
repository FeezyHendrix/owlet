export type RuntimeMessage =
  | { type: 'ping' }
  | { type: 'open-settings' }
  | { type: 'open-onboarding' }

export type RuntimeResponse = { ok: true; data?: unknown } | { ok: false; error: string }
