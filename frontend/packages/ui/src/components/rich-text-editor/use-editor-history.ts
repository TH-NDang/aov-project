import * as React from "react"
import type { EntityReferenceInputHandle } from "../entity-reference-input"
import type { EditorSnapshot, TextSelection } from "../../lib/entity-rich-text-editor"

/**
 * The text being edited, its selection and its undo history of up to 100 steps. A value that changes from outside
 * starts a new history and calls `onExternalChange`.
 */
export function useEditorHistory({
  value,
  onChange,
  limit,
  area,
  onExternalChange,
}: {
  value: string
  onChange: (value: string) => void
  limit: number
  area: React.RefObject<EntityReferenceInputHandle | null>
  onExternalChange: () => void
}) {
  const current = React.useRef(value)
  const selection = React.useRef<TextSelection>({ start: 0, end: 0 })
  const history = React.useRef<EditorSnapshot[]>([{ value, start: 0, end: 0 }])
  const position = React.useRef(0)
  const [caret, setCaret] = React.useState<TextSelection>({ start: 0, end: 0 })
  const [notice, setNotice] = React.useState("")
  const [, refresh] = React.useReducer((n: number) => n + 1, 0)
  const updateCaret = React.useCallback((next: TextSelection) => {
    setCaret((previous) => (previous.start === next.start && previous.end === next.end ? previous : next))
  }, [])
  const externalChange = React.useEffectEvent(onExternalChange)
  React.useLayoutEffect(() => {
    if (value !== current.current) {
      current.current = value
      history.current = [{ value, start: 0, end: 0 }]
      position.current = 0
      selection.current = { start: 0, end: 0 }
      updateCaret(selection.current)
      externalChange()
    }
  }, [value, updateCaret])

  const focusAt = (start: number, end: number) =>
    queueMicrotask(() => {
      area.current?.focus()
      area.current?.setSelectionRange(start, end)
    })

  /** Records a new state of the text, unless it would grow past the limit. */
  const commit = (snapshot: EditorSnapshot, focus = true) => {
    if (snapshot.value.length > limit && snapshot.value.length > current.current.length) {
      setNotice(`Nội dung vượt giới hạn ${limit.toLocaleString()} ký tự.`)
      return false
    }
    if (snapshot.value !== history.current[position.current]?.value) {
      history.current = history.current.slice(0, position.current + 1)
      history.current.push(snapshot)
      if (history.current.length > 100) history.current.shift()
      position.current = history.current.length - 1
    }
    current.current = snapshot.value
    onChange(snapshot.value)
    selection.current = { start: snapshot.start, end: snapshot.end }
    updateCaret(selection.current)
    setNotice("")
    if (focus) focusAt(snapshot.start, snapshot.end)
    refresh()
    return true
  }

  /** Steps back, or forward with `redo`; says whether there was a step to take. */
  const undo = (redo = false) => {
    const next = position.current + (redo ? 1 : -1)
    if (next < 0 || next >= history.current.length) return false
    position.current = next
    const snapshot = history.current[next]!
    current.current = snapshot.value
    onChange(snapshot.value)
    selection.current = { start: snapshot.start, end: snapshot.end }
    updateCaret(selection.current)
    focusAt(snapshot.start, snapshot.end)
    refresh()
    return true
  }

  /** Follows the selection, which the current step also remembers. */
  const select = (next: TextSelection) => {
    selection.current = next
    updateCaret(next)
    const snapshot = history.current[position.current]
    if (snapshot?.value === current.current) Object.assign(snapshot, next)
  }

  /** Follows text typed through an input method, which becomes a step only once the composition ends. */
  const track = (snapshot: EditorSnapshot) => {
    if (snapshot.value.length > limit && snapshot.value.length > current.current.length) return false
    current.current = snapshot.value
    onChange(snapshot.value)
    selection.current = snapshot
    updateCaret(snapshot)
    return true
  }

  return {
    /** The text as the editor last saw it, which may be ahead of `value` until the parent renders again. */
    current,
    selection,
    caret,
    notice,
    setNotice,
    canUndo: position.current > 0,
    canRedo: position.current < history.current.length - 1,
    commit,
    undo,
    select,
    track,
  }
}
