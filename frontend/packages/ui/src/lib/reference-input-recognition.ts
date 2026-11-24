import {
  defaultEntityColor,
  parseRichText,
  type createEntityIndex,
  type EntityReference,
  type RichTextOptions,
} from "./entity-rich-text"

type PassiveHighlight = { range: Range; color?: string; underline: boolean; entity: EntityReference }
type HighlightRuntime = {
  Highlight?: new (...ranges: Range[]) => unknown
  CSS?: { highlights?: Map<string, unknown> }
}

/** Highlight exact names without inserting markup, replacing text, or moving the caret. */
export function passiveReferenceHighlights(
  root: HTMLElement,
  index: ReturnType<typeof createEntityIndex>,
  options: Pick<RichTextOptions, "markup" | "firstOccurrenceOnly"> = {},
) {
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
    if (!parent || parent.closest('[data-reference-token], [data-decoration], [data-format-open="<noauto>" i]'))
      continue
    // Literal source tags are editable text, not parsed formatting with matching DOM offsets.
    if (/<\/?(?:b|i|muted|noauto|color|ref)(?:[=>]|\b)/i.test(text)) continue
    let offset = 0
    for (const part of parseRichText(text, index, { ...options, maxReferences: 500 - matches.length })) {
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
          underline: part.entity.display?.underline === true,
          entity: part.entity,
        })
      }
    }
  }
  return matches
}

/** Custom Highlights decorate existing text nodes; unsupported browsers keep normal editable text. */
export function paintPassiveReferences(root: HTMLElement, index: ReturnType<typeof createEntityIndex>, key: string) {
  return registerPassiveHighlights(root, passiveReferenceHighlights(root, index), key)
}

/** Paints matches found earlier, so icons can be placed beside them first. */
export function registerPassiveHighlights(root: HTMLElement, matches: readonly PassiveHighlight[], key: string) {
  const runtime = root.ownerDocument.defaultView as unknown as HighlightRuntime | null
  const registry = runtime?.CSS?.highlights
  const Highlight = runtime?.Highlight
  if (!registry || !Highlight) return () => {}

  const groups = new Map<string, { ranges: Range[]; color?: string; underline: boolean }>()
  for (const match of matches) {
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

/** Icons go before the first mention of each name, as the published text shows them; terms and hidden icons get none. */
export function decorateReferences(root: HTMLElement, matches: readonly PassiveHighlight[]) {
  const seen = new Set<string>()
  const added: { element: HTMLSpanElement; entity: EntityReference }[] = []
  for (const match of matches) {
    const { entity } = match
    const key = `${entity.kind}:${entity.id}`
    if (entity.kind === "term" || entity.display?.showIcon === false || seen.has(key)) continue
    seen.add(key)
    const node = match.range.startContainer
    if (node.nodeType !== 3 || !node.parentNode) continue
    const text = node as Text
    const offset = match.range.startOffset
    const before = offset > 0 ? text.splitText(offset) : text
    const icon = root.ownerDocument.createElement("span")
    icon.setAttribute("data-decoration", "")
    if (offset > 0) icon.setAttribute("data-split", "")
    icon.setAttribute("contenteditable", "false")
    icon.setAttribute("aria-hidden", "true")
    icon.className = "mr-1 inline-flex size-4 select-none align-[-0.15em]"
    before.parentNode!.insertBefore(icon, before)
    added.push({ element: icon, entity })
  }
  return added
}

/** Takes the icons out again and joins the text each one split, so the DOM is as the editor painted it. */
export function removeDecorations(root: HTMLElement) {
  for (const icon of [...root.querySelectorAll<HTMLElement>("[data-decoration]")]) {
    const previous = icon.previousSibling
    const next = icon.nextSibling
    const split = icon.hasAttribute("data-split")
    icon.remove()
    if (split && previous?.nodeType === 3 && next?.nodeType === 3) {
      ;(previous as Text).appendData((next as Text).data)
      next.parentNode?.removeChild(next)
    }
  }
}
