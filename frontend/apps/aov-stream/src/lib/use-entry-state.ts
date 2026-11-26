import { createContext, useContext, useEffect, useState } from "react"
import { entryMemory, type Choice } from "./entry-memory.ts"

const STORED = "stream-choices"

/** The entry of the history a page is drawn for, and whether the reader went back or forward to it. */
export type Entry = { key: string; returning: boolean }
export const EntryContext = createContext<Entry>({ key: "", returning: false })

/** What this tab chose before it was reloaded; a browser that keeps nothing starts without it. */
function stored() {
  try {
    return sessionStorage.getItem(STORED)
  } catch {
    return null
  }
}

const memory = entryMemory(typeof window === "undefined" ? null : stored())

/** Keeps the choices of this tab for a reload. */
export function keepChoices() {
  try {
    sessionStorage.setItem(STORED, memory.save())
  } catch {
    // The next visit then starts with every choice as it first is.
  }
}

/**
 * A choice that is no part of the address. Going back to a page finds it as it was left; a step that keeps the page, such
 * as another period, keeps it too. Two choices of one page need two names.
 */
export function useEntryState<T extends Choice>(name: string, first: T): [T, (choice: T) => void] {
  const { key, returning } = useContext(EntryContext)
  const kept = () => (memory.recall(key, name) as T | undefined) ?? first
  const [state, setState] = useState(() => ({ key, name, choice: kept() }))
  let shown = state
  if (state.key !== key || state.name !== name) {
    shown = { key, name, choice: returning || state.name !== name ? kept() : state.choice }
    setState(shown)
  }
  const { choice } = shown
  useEffect(() => {
    if (choice !== first || memory.recall(key, name) !== undefined) memory.remember(key, name, choice)
  }, [key, name, choice, first])
  return [choice, (next) => setState({ key, name, choice: next })]
}
