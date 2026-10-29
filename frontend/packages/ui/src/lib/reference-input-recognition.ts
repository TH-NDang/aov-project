import { defaultEntityColor, parseRichText, type createEntityIndex } from "./entity-rich-text"

type PassiveHighlight = { range: Range; color?: string; underline: boolean }
type HighlightRuntime = {
  Highlight?: new (...ranges: Range[]) => unknown
  CSS?: { highlights?: Map<string, unknown> }
}

/** Highlight exact names without inserting markup, replacing text, or moving the caret. */
export function passiveReferenceHighlights(root: HTMLElement, index: ReturnType<typeof createEntityIndex>) {
  const matches: PassiveHighlight[] = []
  const document = root.ownerDocument
  const walker = document.createTreeWalker(root, 4)
  const visibleText = root.textContent ?? ""
  let visibleOffset = 0
  let node: Node | null
  while ((node = walker.nextNode()) && matches.length < 500) {
    const text = node.nodeValue ?? ""
    const nodeOffset = visibleOffset
    visibleOffset += text.length
    const parent = node.parentElement
    if (!parent || parent.closest('[data-reference-token], [data-format-open="<noauto>" i]')) continue
    // Literal source tags are editable text, not parsed formatting with matching DOM offsets.
    if (/<\/?(?:b|i|noauto|color|ref)(?:[=>]|\b)/i.test(text)) continue
    let offset = 0
    for (const part of parseRichText(text, index, { maxReferences: 500 - matches.length })) {
      if (part.type === "text") offset += part.text.length
      else if (part.type === "reference") {
        const start = offset
        offset += part.label.length
        const before = visibleText.slice(Math.max(0, nodeOffset + start - 2), nodeOffset + start)
        const after = visibleText.slice(nodeOffset + offset, nodeOffset + offset + 2)
        // Formatting splits text nodes, but it must not turn a word fragment into a name.
        if (/[\p{L}\p{M}\p{N}_]$/u.test(before) || /^[\p{L}\p{M}\p{N}_]/u.test(after)) continue
        const range = document.createRange()
        range.setStart(node, start)
        range.setEnd(node, offset)
        matches.push({
          range,
          color: parent.closest('[data-format-open^="<color="]')
            ? undefined
            : (part.entity.display?.color ?? defaultEntityColor(part.entity)),
          underline: part.entity.display?.underline !== false,
        })
      }
    }
  }
  return matches
}

/** Custom Highlights decorate existing text nodes; unsupported browsers keep normal editable text. */
export function paintPassiveReferences(root: HTMLElement, index: ReturnType<typeof createEntityIndex>, key: string) {
  const runtime = root.ownerDocument.defaultView as unknown as HighlightRuntime | null
  const registry = runtime?.CSS?.highlights
  const Highlight = runtime?.Highlight
  if (!registry || !Highlight) return () => {}

  const groups = new Map<string, { ranges: Range[]; color?: string; underline: boolean }>()
  for (const match of passiveReferenceHighlights(root, index)) {
    const group = `${match.color ?? "inherit"}:${match.underline}`
    const existing = groups.get(group) ?? { ranges: [], color: match.color, underline: match.underline }
    existing.ranges.push(match.range)
    groups.set(group, existing)
  }

  const style = root.ownerDocument.createElement("style")
  const names: string[] = []
  const rules: string[] = []
  for (const group of groups.values()) {
    const name = `aov-reference-${key}-${names.length}`
    names.push(name)
    registry.set(name, new Highlight(...group.ranges))
    const color =
      group.color && /^(?:#[\da-f]{3,8}|light-dark\(#[\da-f]{6}, #[\da-f]{6}\))$/i.test(group.color)
        ? `color:${group.color};`
        : ""
    rules.push(`::highlight(${name}){${color}${group.underline ? "text-decoration:underline dotted;" : ""}}`)
  }
  style.textContent = rules.join("\n")
  if (rules.length) root.ownerDocument.head.append(style)
  return () => {
    for (const name of names) registry.delete(name)
    style.remove()
  }
}
