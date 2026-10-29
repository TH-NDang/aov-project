import type { EntityKind } from "./entity-rich-text"
import type { EditorSnapshot, TextSelection } from "./entity-rich-text-editor"

export type ReferenceInputPart =
  { type: "text"; text: string } | { type: "reference"; token: string; kind: EntityKind; id: string; label: string }

export type ReferenceInputNode =
  | ReferenceInputPart
  | {
      type: "format"
      tag: "b" | "i" | "color" | "noauto"
      open: string
      close: string
      color?: string
      children: ReferenceInputNode[]
    }

const reference =
  /<ref=(hero|skill|item|enchantment|arcana|spell|team|player|country|term):([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})>([^<>]+)<\/ref>/g
const skillId = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\.[a-z0-9]+(?:-[a-z0-9]+)*$/

const formatting = /<(b|i|noauto)>|<color=(#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8}))>|<\/(b|i|color|noauto)>/gi
const formatOpening = /^<(b|i|noauto)>$|^<color=(#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8}))>$/i

function splitReferences(value: string, budget: { references: number }): ReferenceInputPart[] {
  const parts: ReferenceInputPart[] = []
  let at = 0
  for (const match of value.matchAll(reference)) {
    if (budget.references >= 500) break
    if (match[1] === "skill" && (!skillId.test(match[2]!) || match[2]!.length > 101)) continue
    if (match.index > at) parts.push({ type: "text", text: value.slice(at, match.index) })
    parts.push({ type: "reference", token: match[0], kind: match[1] as EntityKind, id: match[2]!, label: match[3]! })
    at = match.index + match[0].length
    // Saved references share the same bounded budget as remote identity lookups.
    budget.references++
  }
  if (at < value.length) parts.push({ type: "text", text: value.slice(at) })
  return parts
}

export function referenceInputParts(value: string): ReferenceInputPart[] {
  const parts = splitReferences(value.slice(0, 100000), { references: 0 })
  if (value.length > 100000) parts.push({ type: "text", text: value.slice(100000) })
  return parts
}

/** Only complete supported formatting is projected; malformed source remains visible and inert. */
export function referenceInputNodes(value: string): ReferenceInputNode[] {
  const source = value.slice(0, 100000)
  const tokens = [...source.matchAll(formatting)]
  const pairs = new Map<number, number>()
  const stack: { index: number; tag: string; valid: boolean }[] = []
  let invalidThrough = -1
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!
    if (token[3]) {
      const opening = stack.at(-1)
      if (!opening) continue
      if (opening.tag !== token[3].toLowerCase()) {
        invalidThrough = index
        continue
      }
      stack.pop()
      if (opening.valid && opening.index > invalidThrough) pairs.set(opening.index, index)
    } else {
      stack.push({ index, tag: token[1]?.toLowerCase() ?? "color", valid: stack.length < 8 })
    }
  }
  const budget = { references: 0 }
  const build = (from: number, to: number, first: number, last: number): ReferenceInputNode[] => {
    const nodes: ReferenceInputNode[] = []
    let at = from
    for (let index = first; index < last; index++) {
      const token = tokens[index]!
      const closingIndex = pairs.get(index)
      if (closingIndex === undefined) continue
      const closing = tokens[closingIndex]!
      if (token.index > at) nodes.push(...splitReferences(source.slice(at, token.index), budget))
      nodes.push({
        type: "format",
        tag: (token[1]?.toLowerCase() ?? "color") as Extract<ReferenceInputNode, { type: "format" }>["tag"],
        open: token[0],
        close: closing[0],
        ...(token[2] ? { color: token[2] } : {}),
        children: build(token.index + token[0].length, closing.index, index + 1, closingIndex),
      })
      at = closing.index + closing[0].length
      index = closingIndex
    }
    if (at < to) nodes.push(...splitReferences(source.slice(at, to), budget))
    return nodes
  }
  const nodes = build(0, source.length, 0, tokens.length)
  if (value.length > 100000) nodes.push({ type: "text", text: value.slice(100000) })
  return nodes
}

export function referenceInputPlainText(value: string): string {
  const flatten = (nodes: ReferenceInputNode[]): string =>
    nodes
      .map((node) => (node.type === "format" ? flatten(node.children) : node.type === "text" ? node.text : node.label))
      .join("")
  return flatten(referenceInputNodes(value))
}

type Atom = { node: Element; start: number; end: number }
type Text = { node: Node; start: number; end: number }
type Format = { node: Element; start: number; innerStart: number; innerEnd: number; end: number }
type SourceMap = {
  value: string
  atoms: Atom[]
  texts: Text[]
  formats: Format[]
  boundaries: Map<Node, number[]>
}

function sourceMap(root: HTMLElement): SourceMap {
  const result: SourceMap = { value: "", atoms: [], texts: [], formats: [], boundaries: new Map() }
  let hasContent = false
  let endsLine = false
  const visible = (value: string) => {
    if (value) {
      hasContent = true
      endsLine = value.endsWith("\n")
    }
  }
  const append = (value: string, content = true) => {
    result.value += value
    if (content) visible(value)
  }
  const walk = (node: Node) => {
    const start = result.value.length
    if (node.nodeType === 3) {
      append(node.nodeValue ?? "")
      result.texts.push({ node, start, end: result.value.length })
      return
    }
    if (node.nodeType !== 1) return
    const element = node as Element
    if (element.tagName === "BR" && element.hasAttribute("data-input-tail")) {
      result.boundaries.set(node, [start, start])
      return
    }
    if (node === root && node.childNodes.length === 1 && (node.firstChild as Element)?.tagName === "BR") {
      result.boundaries.set(node, [start, start])
      result.boundaries.set(node.firstChild!, [start, start])
      return
    }
    const token = element.getAttribute("data-reference-token")
    const reference =
      token && referenceInputParts(token).find((part) => part.type === "reference" && part.token === token)
    if (reference && reference.type === "reference") {
      append(reference.token, false)
      visible(reference.label)
      result.atoms.push({ node: element, start, end: result.value.length })
      return
    }
    if (element.tagName === "BR") {
      append("\n")
      result.boundaries.set(node, [start, result.value.length])
      return
    }
    const open = element.getAttribute("data-format-open") ?? ""
    const close = element.getAttribute("data-format-close") ?? ""
    const opening = open.match(formatOpening)
    const tag = opening ? (opening[1]?.toLowerCase() ?? "color") : undefined
    const formatted = !!tag && close.toLowerCase() === `</${tag}>`
    if (formatted) append(open, false)
    const innerStart = result.value.length
    const boundaries = [result.value.length]
    let previousBlock = false
    for (const child of node.childNodes) {
      const block = child.nodeType === 1 && /^(DIV|P|LI)$/.test((child as Element).tagName)
      if ((block || previousBlock) && hasContent && !endsLine) append("\n")
      if (block && child.childNodes.length === 1 && (child.firstChild as Element)?.tagName === "BR") {
        result.boundaries.set(child, [result.value.length, result.value.length])
      } else walk(child)
      boundaries.push(result.value.length)
      previousBlock = block
    }
    result.boundaries.set(node, boundaries)
    if (formatted) {
      const innerEnd = result.value.length
      append(close, false)
      result.formats.push({ node: element, start, innerStart, innerEnd, end: result.value.length })
    }
  }
  walk(root)
  return result
}

export function serializeReferenceInput(root: HTMLElement): string {
  return sourceMap(root).value
}

function sourceOffset(map: SourceMap, node: Node, offset: number, end: boolean): number {
  const atom = map.atoms.find((entry) => entry.node === node || entry.node.contains(node))
  if (atom) return end || offset > 0 ? atom.end : atom.start
  const text = map.texts.find((entry) => entry.node === node)
  if (text) return Math.max(text.start, Math.min(text.start + offset, text.end))
  const boundaries = map.boundaries.get(node)
  return boundaries?.[Math.min(offset, boundaries.length - 1)] ?? map.value.length
}

function selectionFromMap(root: HTMLElement, map: SourceMap): TextSelection {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount) return { start: 0, end: 0 }
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return { start: 0, end: 0 }
  const start = sourceOffset(map, range.startContainer, range.startOffset, false)
  const end = sourceOffset(map, range.endContainer, range.endOffset, !range.collapsed)
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

export function getReferenceInputSelection(root: HTMLElement): TextSelection {
  return selectionFromMap(root, sourceMap(root))
}

/** Read source and selection from one consistent DOM traversal. */
export function readReferenceInputSnapshot(root: HTMLElement): EditorSnapshot {
  const map = sourceMap(root)
  return { value: map.value, ...selectionFromMap(root, map) }
}

function domPoint(root: HTMLElement, map: SourceMap, value: number, end: boolean): [Node, number] {
  const position = Math.max(0, Math.min(value, map.value.length))
  for (const tail of root.querySelectorAll("br[data-input-tail]")) {
    const parent = tail.parentNode!
    const boundaries = map.boundaries.get(parent)
    const index = [...parent.childNodes].indexOf(tail)
    if (position === boundaries?.[index]) return [parent, index]
  }
  const text = map.texts.find((entry) => position >= entry.start && position <= entry.end)
  if (text) return [text.node, position - text.start]
  const atom = map.atoms.find((entry) => position >= entry.start && position <= entry.end)
  if (atom) {
    const parent = atom.node.parentNode!
    const index = [...parent.childNodes].indexOf(atom.node)
    const after = position === atom.end || (position > atom.start && end)
    return [parent, index + Number(after)]
  }
  const format = map.formats.find((entry) => position >= entry.start && position <= entry.end)
  if (format) {
    if (position === format.start || position === format.end) {
      const parent = format.node.parentNode!
      const index = [...parent.childNodes].indexOf(format.node)
      return [parent, index + Number(position === format.end)]
    }
    if (position <= format.innerStart) return [format.node, 0]
    if (position >= format.innerEnd) return [format.node, format.node.childNodes.length]
  }
  return [root, position === 0 ? 0 : root.childNodes.length]
}

export function setReferenceInputSelection(root: HTMLElement, start: number, end: number): void {
  const map = sourceMap(root)
  const range = root.ownerDocument.createRange()
  const collapsed = start === end
  const left = domPoint(root, map, start, collapsed)
  const right = domPoint(root, map, end, true)
  const selection = root.ownerDocument.getSelection()
  const previous = selection?.rangeCount ? selection.getRangeAt(0) : undefined
  if (
    previous?.startContainer === left[0] &&
    previous.startOffset === left[1] &&
    previous.endContainer === right[0] &&
    previous.endOffset === right[1]
  )
    return
  range.setStart(...left)
  range.setEnd(...right)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export function referenceInputCaretRect(root: HTMLElement, position: number): DOMRect {
  const map = sourceMap(root)
  const range = root.ownerDocument.createRange()
  range.setStart(...domPoint(root, map, position, true))
  range.collapse(true)
  const bounds = root.getBoundingClientRect()
  const view = root.ownerDocument.defaultView!
  const style = view.getComputedStyle(root)
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5 || 20
  const rect = typeof range.getClientRects === "function" ? range.getClientRects()[0] : undefined
  if (rect && rect.height) return new view.DOMRect(rect.left, rect.top, Math.max(1, rect.width), rect.height)
  const atom = map.atoms.find((entry) => entry.end === position || entry.start === position)
  const adjacent = atom?.node.getBoundingClientRect()
  return new view.DOMRect(
    adjacent?.width ? (position === atom!.end ? adjacent.right : adjacent.left) : bounds.left + 12,
    adjacent?.height ? adjacent.top : bounds.top + 8,
    1,
    adjacent?.height || lineHeight,
  )
}
