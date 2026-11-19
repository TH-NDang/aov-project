import { useSyncExternalStore } from "react"
import { localeText } from "@aov/ui/lib/locale-text"

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
/** The language as a BCP 47 tag, for `Intl` and for shared components that take a `locale`. */
export const streamLanguageTag = (value: Locale = locale) => (value === "en" ? "en-US" : "vi-VN")
/**
 * Picks the wording outside React, in models and request helpers. It reads the choice when called, so call it while
 * rendering or handling an event, never at module level.
 */
export const streamText = (vi: string, en: string) => localeText(locale)(vi, en)

/** Screen readers pick their voice from the document language. */
function announceLanguage() {
  if (typeof document !== "undefined") document.documentElement.lang = streamLanguageTag()
}
announceLanguage()

export function setStreamLocale(value: string) {
  locale = value === "en" ? "en" : "vi"
  try {
    localStorage.setItem(key, locale)
  } catch {
    /* Keep the choice in memory when storage is unavailable. */
  }
  announceLanguage()
  listeners.forEach((listener) => listener())
}
export function useStreamLocale() {
  const value = useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, streamLocale)
  return {
    locale: value,
    languageTag: streamLanguageTag(value),
    text: localeText(value),
    setLocale: setStreamLocale,
  }
}
