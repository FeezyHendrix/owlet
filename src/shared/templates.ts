export const TEMPLATE_VARS = [
  'selection',
  'paragraph',
  'pageText',
  'title',
  'url',
  'question',
] as const
export type TemplateVar = (typeof TEMPLATE_VARS)[number]

export type TemplateVars = Partial<Record<TemplateVar, string>>

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (Object.hasOwn(vars, key)) {
      const value = vars[key as TemplateVar]
      return value ?? match
    }
    return match
  })
}

export function listUsedVars(template: string): TemplateVar[] {
  const seen = new Set<TemplateVar>()
  for (const match of template.matchAll(/\{\{(\w+)\}\}/g)) {
    const key = match[1] as TemplateVar
    if (TEMPLATE_VARS.includes(key)) seen.add(key)
  }
  return Array.from(seen)
}
