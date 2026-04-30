import { z } from 'zod'

export const ProviderKindSchema = z.enum(['openai', 'anthropic', 'openai-compatible'])
export type ProviderKind = z.infer<typeof ProviderKindSchema>

export const ProviderSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(60),
  kind: ProviderKindSchema,
  baseUrl: z.string().url(),
  apiKeyRef: z.string().min(1),
  defaultModel: z.string().min(1),
})
export type Provider = z.infer<typeof ProviderSchema>

export const ContextScopeSchema = z.enum(['selection', 'selection+paragraph', 'full-page'])
export type ContextScope = z.infer<typeof ContextScopeSchema>

export const ActionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  icon: z.string().max(40).default('sparkles'),
  systemPrompt: z.string().max(4000),
  userPromptTemplate: z.string().min(1).max(4000),
  contextScope: ContextScopeSchema,
  providerId: z.string().min(1),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().max(32_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
})
export type Action = z.infer<typeof ActionSchema>

export const UiSchema = z.object({
  theme: z.enum(['auto', 'light', 'dark']).default('auto'),
  fabEnabled: z.boolean().default(true),
  hotkey: z.string().default('Ctrl+Shift+E'),
  minSelectionChars: z.number().int().positive().default(3),
  maxSelectionChars: z.number().int().positive().default(20_000),
})
export type UiPrefs = z.infer<typeof UiSchema>

export const SiteRuleSchema = z.object({
  pattern: z.string().min(1),
  enabled: z.boolean(),
})
export type SiteRule = z.infer<typeof SiteRuleSchema>

export const ConfigSchema = z.object({
  version: z.literal(1),
  providers: z.array(ProviderSchema).default([]),
  actions: z.array(ActionSchema).default([]),
  defaultActionId: z.string().nullable().default(null),
  ui: UiSchema.default({}),
  siteRules: z.array(SiteRuleSchema).default([]),
})
export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({ version: 1 })
