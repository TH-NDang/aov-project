import { useEffect, useRef } from "react"
import { useHotkeys } from "@/app/hotkeys"

type Keys = { save: () => void; undo: () => void; redo: () => void; step: (index: number) => void }

const typesText = (target: EventTarget | null) =>
  target instanceof HTMLElement && (!!target.closest("input, textarea, select") || target.isContentEditable)

/**
 * Keys of the whole workspace: Ctrl+S saves the draft, Ctrl+Z and Ctrl+Shift+Z step through its edits, Alt+1 to Alt+6
 * open a step. Undo inside a field stays the browser's own, and an open dialog or sheet keeps its keys.
 */
export function useWorkspaceKeys(keys: Keys) {
  const { enabled } = useHotkeys()
  const latest = useRef(keys)
  useEffect(() => {
    latest.current = keys
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector("[role=dialog], [role=alertdialog]")) return
      const command = (event.ctrlKey || event.metaKey) && !event.altKey
      const key = event.key.toLowerCase()
      if (command && key === "s") latest.current.save()
      else if (command && !typesText(event.target) && key === "z") {
        if (event.shiftKey) latest.current.redo()
        else latest.current.undo()
      } else if (command && !typesText(event.target) && key === "y") latest.current.redo()
      else if (event.altKey && !event.ctrlKey && !event.metaKey && /^Digit[1-6]$/.test(event.code))
        latest.current.step(Number(event.code.slice(5)) - 1)
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled])
}
