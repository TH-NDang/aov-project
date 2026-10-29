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
  /<\/?(?:b|i|noauto|color(?:=#[\da-f]{3,8})?|ref(?:=(?:hero|skill|item|enchantment|arcana|spell|term|team|player|country):[a-zA-Z0-9._-]+)?)>/gi

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

export type ReferenceSuggestion = TextSelection & { query: string; explicit: boolean }

function plainReferenceCandidates(value: string, selection: TextSelection): ReferenceSuggestion[] {
  if (selection.start !== selection.end || !safeSelection(value, selection)) return []
  if (/[\p{L}\p{M}\p{N}_-]/u.test(value[selection.end] ?? "")) return []
  const before = value.slice(0, selection.start)
  const context = before.toLowerCase()
  if (context.lastIndexOf("<noauto>") > context.lastIndexOf("</noauto>")) return []
  const tail = before.match(/(?:^|[\s([{>])([\p{L}\p{M}\p{N}_-]+(?:[ \t]+[\p{L}\p{M}\p{N}_-]+){0,5})$/u)?.[1]
  if (!tail) return []
  const start = selection.start - tail.length
  return [...tail.matchAll(/[\p{L}\p{M}\p{N}_-]+/gu)]
    .map((word) => ({
      start: start + word.index,
      end: selection.start,
      query: tail.slice(word.index),
      explicit: false,
    }))
    .filter((candidate) => candidate.query.length <= 60 && safeSelection(value, candidate))
}

/** Only an explicit mention opens the picker; ordinary text is recognized passively. */
export function referenceSuggestionAt(
  value: string,
  selection: TextSelection,
  _index: ReferenceSearchIndex,
): ReferenceSuggestion | null {
  const mention = mentionAt(value, selection)
  return mention ? { ...mention, explicit: true } : null
}

export function referenceReplacementRange(
  value: string,
  suggestion: ReferenceSuggestion,
  entity: EntityReference,
  locale: string,
  fallbackLocale: string,
): TextSelection {
  if (suggestion.explicit) return suggestion
  const translation = referenceTranslation(entity, locale, fallbackLocale)
  const names = [translation?.name, ...(translation?.aliases ?? [])]
    .filter((name): name is string => !!name)
    .map(foldEntitySearch)
  const phrase = plainReferenceCandidates(value, { start: suggestion.end, end: suggestion.end }).find((candidate) =>
    names.some((name) => name.startsWith(foldEntitySearch(candidate.query))),
  )
  return phrase ?? suggestion
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
    ["đội tuyển", "team"],
    ["đội", "team"],
    ["tuyển thủ", "player"],
    ["quốc gia / khu vực", "country"],
    ["quốc gia", "country"],
    ["khu vực", "country"],
  ] as const
  const group = groups.find(([name]) => source === fold(name) || source.startsWith(fold(name) + " "))
  const needle = group ? source.slice(fold(group[0]).length).trim() : source
  return { kind: group?.[1], needle }
}

export function createReferenceSearchIndex(entities: EntityReference[], locale: string, fallbackLocale: string) {
  return entities
    .slice(0, 4000)
    .flatMap((entity) => {
      if (entity.kind === "skill" && !validSkillReference(entity)) return []
      const translation = referenceTranslation(entity, locale, fallbackLocale)
      if (!translation || !translation.name.trim()) return []
      return [
        {
          entity,
          translation,
          search: [translation.name, ...translation.aliases, entity.id].map((text) => foldEntitySearch(text).trim()),
        },
      ]
    })
    .sort((a, b) => a.translation.name.localeCompare(b.translation.name))
}

export type ReferenceSearchIndex = ReturnType<typeof createReferenceSearchIndex>

export function searchReferenceChoices(index: ReferenceSearchIndex, query: string) {
  const { kind, needle } = referenceSearchGroup(query)
  return index.filter(
    (entry) => (!kind || entry.entity.kind === kind) && (!needle || entry.search.some((text) => text.includes(needle))),
  )
}

export function referenceChoices(entities: EntityReference[], locale: string, fallbackLocale: string, query: string) {
  return searchReferenceChoices(createReferenceSearchIndex(entities, locale, fallbackLocale), query)
}
