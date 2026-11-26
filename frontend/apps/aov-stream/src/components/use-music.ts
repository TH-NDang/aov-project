import { useSyncExternalStore } from "react"
import type { MusicView } from "../lib/music-store"
import { music } from "./music-session"

/** Reads one thing of the music; `select` returns a primitive or a member of the view, never a new object. */
export function useMusic<T>(select: (view: MusicView) => T): T {
  return useSyncExternalStore(music.subscribe, () => select(music.view()))
}
