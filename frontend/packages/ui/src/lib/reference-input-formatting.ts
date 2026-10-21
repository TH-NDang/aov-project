import { referenceInputNodes, type ReferenceInputNode } from "./reference-input-dom"
import type { EditorSnapshot, TextSelection } from "./entity-rich-text-editor"

type FormatKind = "b" | "i" | "color"
type Mark = Pick<Extract<ReferenceInputNode, { type: "format" }>, "tag" | "open" | "close" | "color">
type Run = { text: string; atom: boolean; marks: Mark[]; start: number; end: number; selected?: boolean }
const colorPattern = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i

function flatten(value: string) {
  const runs: Run[] = []
  const edges = new Set([0, value.length])
  let position = 0
  const walk = (nodes: ReferenceInputNode[], marks: Mark[]) => {
    for (const node of nodes) {
      edges.add(position)
      if (node.type === "format") {
        position += node.open.length
        edges.add(position)
        const next = [...marks, { tag: node.tag, open: node.open, close: node.close, color: node.color }]
        if (node.children.length) walk(node.children, next)
        else runs.push({ text: "", atom: false, marks: next, start: position, end: position })
        edges.add(position)
        position += node.close.length
      } else {
        const text = node.type === "text" ? node.text : node.token
        runs.push({ text, atom: node.type === "reference", marks, start: position, end: position + text.length })
        position += text.length
      }
      edges.add(position)
    }
  }
  walk(referenceInputNodes(value), [])
  return { runs, edges }
}

function sameMark(left: Mark, right: Mark) {
  return left.tag === right.tag && left.open === right.open && left.close === right.close
}

export function referenceFormatState(value: string, selection: TextSelection) {
  const { runs } = flatten(value)
  const collapsed = selection.start === selection.end
  const selected = collapsed
    ? runs
        .filter((run) =>
          run.atom
            ? selection.start === run.start || selection.start === run.end
            : selection.start >= run.start && selection.start <= run.end,
        )
        .slice(0, 1)
    : runs.filter((run) => run.end > selection.start && run.start < selection.end)
  const color = selected.map((run) => [...run.marks].reverse().find((mark) => mark.tag === "color")?.color)
  return {
    bold: selected.length > 0 && selected.every((run) => run.marks.some((mark) => mark.tag === "b")),
    italic: selected.length > 0 && selected.every((run) => run.marks.some((mark) => mark.tag === "i")),
    color: color.length && color.every((value) => value === color[0]) ? color[0] : undefined,
  }
}

/** Transform visible runs, so selections may cross hidden formatting boundaries without exposing source tags. */
export function toggleReferenceFormat(
  value: string,
  selection: TextSelection,
  kind: FormatKind,
  color = "#2563eb",
): EditorSnapshot | null {
  if (
    selection.start < 0 ||
    selection.end < selection.start ||
    selection.end > value.length ||
    (kind === "color" && !colorPattern.test(color))
  )
    return null
  const { runs, edges } = flatten(value)
  const valid = (position: number) =>
    edges.has(position) || runs.some((run) => !run.atom && position >= run.start && position <= run.end)
  if (
    !valid(selection.start) ||
    !valid(selection.end) ||
    runs.some(
      (run) =>
        run.atom &&
        ((selection.start > run.start && selection.start < run.end) ||
          (selection.end > run.start && selection.end < run.end)),
    )
  )
    return null

  const collapsed = selection.start === selection.end
  const selected: Run[] = []
  if (collapsed) {
    let inserted = false
    for (const run of runs) {
      if (!inserted && selection.start < run.start) {
        selected.push({
          text: "",
          atom: false,
          marks: [],
          start: selection.start,
          end: selection.start,
          selected: true,
        })
        inserted = true
      }
      if (!inserted && run.atom && selection.start === run.start) {
        selected.push({ ...run, text: "", atom: false, start: selection.start, end: selection.start, selected: true })
        selected.push(run)
        inserted = true
        continue
      }
      if (!inserted && run.atom && selection.start === run.end) {
        selected.push(run)
        selected.push({ ...run, text: "", atom: false, start: selection.start, end: selection.start, selected: true })
        inserted = true
        continue
      }
      if (!inserted && !run.atom && selection.start >= run.start && selection.start <= run.end) {
        const offset = selection.start - run.start
        if (offset > 0) selected.push({ ...run, text: run.text.slice(0, offset), end: selection.start })
        selected.push({ ...run, text: "", start: selection.start, end: selection.start, selected: true })
        if (offset < run.text.length) selected.push({ ...run, text: run.text.slice(offset), start: selection.start })
        inserted = true
      } else selected.push(run)
    }
    if (!inserted)
      selected.push({ text: "", atom: false, marks: [], start: selection.start, end: selection.start, selected: true })
  } else {
    for (const run of runs) {
      const from = Math.max(run.start, selection.start)
      const to = Math.min(run.end, selection.end)
      if (from >= to) {
        selected.push(run)
        continue
      }
      if (run.atom) selected.push({ ...run, selected: true })
      else {
        if (from > run.start) selected.push({ ...run, text: run.text.slice(0, from - run.start), end: from })
        selected.push({
          ...run,
          text: run.text.slice(from - run.start, to - run.start),
          start: from,
          end: to,
          selected: true,
        })
        if (to < run.end) selected.push({ ...run, text: run.text.slice(to - run.start), start: to })
      }
    }
  }
  const active = selected.filter((run) => run.selected)
  if (!active.length) return null
  const remove = kind !== "color" && active.every((run) => run.marks.some((mark) => mark.tag === kind))
  const added: Mark = { tag: kind, open: kind === "color" ? `<color=${color}>` : `<${kind}>`, close: `</${kind}>` }
  for (const run of active) {
    if (kind === "color" || remove) run.marks = run.marks.filter((mark) => mark.tag !== kind)
    if (!remove && (kind === "color" || !run.marks.some((mark) => mark.tag === kind))) run.marks = [...run.marks, added]
  }

  let output = ""
  let current: Mark[] = []
  let start: number | undefined
  let end = 0
  for (const run of selected) {
    let common = 0
    while (common < current.length && common < run.marks.length && sameMark(current[common]!, run.marks[common]!))
      common++
    for (let index = current.length - 1; index >= common; index--) output += current[index]!.close
    for (let index = common; index < run.marks.length; index++) output += run.marks[index]!.open
    if (run.selected && start === undefined) start = output.length
    output += run.text
    if (run.selected) end = output.length
    current = run.marks
  }
  for (let index = current.length - 1; index >= 0; index--) output += current[index]!.close
  return { value: output, start: start!, end }
}
