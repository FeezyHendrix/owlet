import type { Action, Provider } from './schema'

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export const BUILTIN_ACTIONS_TEMPLATE: Omit<Action, 'id' | 'providerId'>[] = [
  {
    name: 'Ask…',
    kind: 'ask',
    contextScope: 'selection+paragraph',
    systemPrompt:
      "You answer the user's question about a passage they highlighted on a webpage. Be concise, factual, and ground your answer in the selection and surrounding context. If the answer is not in the provided text, say so.",
    userPromptTemplate:
      'Page: {{title}} ({{url}})\n\nSurrounding context:\n{{paragraph}}\n\nHighlighted selection:\n"""\n{{selection}}\n"""\n\nQuestion:\n{{question}}',
    maxTokens: 800,
    temperature: 0.3,
  },
  {
    name: 'Explain',
    kind: 'preset',
    contextScope: 'selection+paragraph',
    systemPrompt:
      'You are a concise explainer. Use plain language. Prefer short paragraphs and bullet lists when helpful. Never invent facts.',
    userPromptTemplate:
      'Explain the following selection in the context of the surrounding paragraph.\n\nPage: {{title}} ({{url}})\n\nParagraph:\n{{paragraph}}\n\nSelection:\n"""\n{{selection}}\n"""',
    maxTokens: 600,
    temperature: 0.3,
  },
  {
    name: 'Summarize',
    kind: 'preset',
    contextScope: 'full-page',
    systemPrompt:
      'You produce tight, factual summaries. Output 3-5 bullet points unless the user asks for more.',
    userPromptTemplate:
      'Summarize the page below, focusing on the highlighted selection.\n\nPage: {{title}} ({{url}})\n\nSelection (focus):\n{{selection}}\n\nFull page:\n{{pageText}}',
    maxTokens: 800,
    temperature: 0.2,
  },
  {
    name: 'Translate to English',
    kind: 'preset',
    contextScope: 'selection',
    systemPrompt:
      'You are a precise translator. Detect the source language. Translate to natural English. Preserve names and numbers. Output translation only, no commentary.',
    userPromptTemplate: 'Translate this to English:\n\n{{selection}}',
    maxTokens: 600,
    temperature: 0.1,
  },
  {
    name: 'Define',
    kind: 'preset',
    contextScope: 'selection+paragraph',
    systemPrompt:
      'You are a dictionary. Give part of speech, a one-sentence definition, and one usage example. Use the surrounding paragraph to choose the correct sense.',
    userPromptTemplate:
      'Define the term in context.\n\nTerm: {{selection}}\n\nContext: {{paragraph}}',
    maxTokens: 250,
    temperature: 0.2,
  },
]

export function makeBuiltinActions(providerId: string): Action[] {
  return BUILTIN_ACTIONS_TEMPLATE.map((tpl) => ({
    ...tpl,
    id: uid('act'),
    providerId,
  }))
}

export function makeProvider(input: {
  kind: Provider['kind']
  label: string
  baseUrl: string
  defaultModel: string
}): Provider {
  const id = uid('prov')
  return {
    id,
    label: input.label,
    kind: input.kind,
    baseUrl: input.baseUrl,
    apiKeyRef: id,
    defaultModel: input.defaultModel,
  }
}
