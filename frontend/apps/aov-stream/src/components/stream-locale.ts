import { useSyncExternalStore } from "react"

type Locale = "vi" | "en"
const key = "aov-stream-locale"
let locale: Locale = "vi"
try {
  if (localStorage.getItem(key) === "en") locale = "en"
} catch {
  /* Storage is optional. */
}
const listeners = new Set<() => void>()
export const streamLocale = () => locale
export function setStreamLocale(value: string) {
  locale = value === "en" ? "en" : "vi"
  try {
    localStorage.setItem(key, locale)
  } catch {
    /* Keep the choice in memory when storage is unavailable. */
  }
  listeners.forEach((listener) => listener())
}
export function useStreamLocale() {
  const value = useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, streamLocale)
  return { locale: value, text: (vi: string, en: string) => (value === "en" ? en : vi), setLocale: setStreamLocale }
}
