import { useSyncExternalStore } from "react"
import type { WatchView } from "../lib/watch-store"
import { watch } from "./watch-session"

/** Reads one thing of the open video; `select` returns a primitive or a member of the view, never a new object. */
export function useWatch<T>(select: (view: WatchView) => T): T {
  return useSyncExternalStore(watch.subscribe, () => select(watch.view()))
}
