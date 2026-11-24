import { useSyncExternalStore } from "react"

/** Past this the page reads as scrolled, and only back above the second does it read as at the top again. */
const DOWN = 64
const UP = 24

let scrolled = false

function read() {
  if (typeof window === "undefined") return false
  // Two thresholds, so bars that change size on the way never flip back and forth around one.
  scrolled = window.scrollY > (scrolled ? UP : DOWN)
  return scrolled
}

function subscribe(notify: () => void) {
  window.addEventListener("scroll", notify, { passive: true })
  return () => window.removeEventListener("scroll", notify)
}

/** Whether the page is scrolled down from its top, for bars that take less room once reading has begun. */
export function useScrolled() {
  return useSyncExternalStore(subscribe, read, () => false)
}
