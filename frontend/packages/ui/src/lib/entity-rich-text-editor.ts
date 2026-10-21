import {
  entityKindLabels,
  foldEntitySearch,
  referenceTranslation,
  validSkillReference,
  type EntityReference,
} from "./entity-rich-text"

export type ReferenceSearchPage = { items: EntityReference[]; page: number; size: number; totalElements: number }
export type EntityReferenceSearch = (request: {
  query: string
  locale: string
  page: number
  signal: AbortSignal
}) => Promise<ReferenceSearchPage>

export type TextSelection = { start: number; end: number }
export type EditorSnapshot = TextSelection & { value: string }
const tag =
  /<\/?(?:b|i|noauto|color(?:=#[\da-f]{3,8})?|ref(?:=(?:hero|skill|item|enchantment|arcana|spell|term):[a-zA-Z0-9._-]+)?)>/gi

export function safeSelection(value: string, selection: TextSelection) {
  const { start, end } = selection
  if (start < 0 || end < start || end > value.length) return false
  const context = (offset: number) => {
    const stack: string[] = []
    for (const token of value.matchAll(tag)) {
      if (token.index >= offset) break
      if (token.index + token[0].length > offset) return null
      const kind = token[0].match(/^<\/?([a-z]+)/i)![1]!.toLowerCase()
      if (token[0].startsWith("</")) {
        if (stack.pop() !== kind) return null
      } else stack.push(kind)
    }
    return stack.includes("ref") ? null : stack.join("/")
  }
  const left = context(start),
    right = context(end)
  return left !== null && right !== null && left === right
}

export function mentionAt(value: string, selection: TextSelection) {
  if (selection.start !== selection.end || !safeSelection(value, selection)) return null
  const match = value.slice(0, selection.start).match(/(?:^|[\s([{>])@([\p{L}\p{M}\p{N}_ -]{0,60})$/u)
  if (!match) return null
  const start = selection.start - match[1]!.length - 1
  return { start, end: selection.start, query: match[1]! }
}

export function wrapSelection(
  value: string,
  selection: TextSelection,
  kind: "b" | "i" | "color",
  color = "#2563eb",
): EditorSnapshot | null {
  if (!safeSelection(value, selection) || (kind === "color" && !/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(color)))
    return null
  const open = kind === "color" ? `<color=${color}>` : `<${kind}>`
  const close = `</${kind}>`
  return {
    value:
      value.slice(0, selection.start) +
      open +
      value.slice(selection.start, selection.end) +
      close +
      value.slice(selection.end),
    start: selection.start + open.length,
    end: selection.end + open.length,
  }
}

export function insertReference(
  value: string,
  selection: TextSelection,
  entity: EntityReference,
  name: string,
  preserveSelection = true,
): EditorSnapshot | null {
  if (
    !safeSelection(value, selection) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(entity.id) ||
    !Object.hasOwn(entityKindLabels, entity.kind) ||
    (entity.kind === "skill" && !validSkillReference(entity))
  )
    return null
  const selected = value.slice(selection.start, selection.end)
  if (selected.includes("<") || selected.includes(">")) return null
  const label = preserveSelection && selected ? selected : name
  if (!label || /[<>]/.test(label)) return null
  const markup = `<ref=${entity.kind}:${entity.id}>${label}</ref>`
  const end = selection.start + markup.length
  return { value: value.slice(0, selection.start) + markup + value.slice(selection.end), start: end, end }
}

export function referenceSearchGroup(query: string) {
  const fold = (text: string) => foldEntitySearch(text).trim()
  const source = fold(query).replace(/^@/, "")
  const groups = [
    ["chiêu thức", "skill"],
    ["kỹ năng", "skill"],
    ["chiêu", "skill"],
    ["thuật ngữ", "term"],
    ["trang bị", "item"],
    ["phù hiệu", "enchantment"],
    ["ngọc bổ trợ", "arcana"],
    ["bảng ngọc", "arcana"],
    ["ngọc", "arcana"],
    ["phụ trợ", "spell"],
    ["bổ trợ", "spell"],
    ["tướng", "hero"],
  ] as const
  const group = groups.find(([name]) => source === fold(name) || source.startsWith(fold(name) + " "))
  const needle = group ? source.slice(fold(group[0]).length).trim() : source
  return { kind: group?.[1], needle }
}

export function referenceChoices(entities: EntityReference[], locale: string, fallbackLocale: string, query: string) {
  const fold = (text: string) => foldEntitySearch(text).trim()
  const { kind, needle } = referenceSearchGroup(query)
  return entities
    .slice(0, 2500)
    .flatMap((entity) => {
      if (kind && entity.kind !== kind) return []
      if (entity.kind === "skill" && !validSkillReference(entity)) return []
      const translation = referenceTranslation(entity, locale, fallbackLocale)
      if (!translation || !translation.name.trim()) return []
      if (needle && ![translation.name, ...translation.aliases, entity.id].some((text) => fold(text).includes(needle)))
        return []
      return [{ entity, translation }]
    })
    .sort((a, b) => a.translation.name.localeCompare(b.translation.name))
}
