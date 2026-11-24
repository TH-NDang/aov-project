import { useSyncExternalStore } from "react"

const MINUTE = 60_000
let now = Date.now()
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  timer ??= setInterval(() => {
    now = Date.now()
    listeners.forEach((notify) => notify())
  }, MINUTE)
  return () => {
    listeners.delete(listener)
    if (listeners.size) return
    clearInterval(timer)
    timer = undefined
  }
}

/** The current time, which moves every minute: a match that starts turns live without a reload. */
export function useNow() {
  return useSyncExternalStore(subscribe, () => now)
}
