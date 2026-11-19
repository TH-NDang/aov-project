import { createContext, createElement, useContext, type ReactNode } from "react"
import { documentLocale, localeText } from "@aov/ui/lib/locale-text"

const LocaleContext = createContext<string | null>(null)

/**
 * Tells the shared components below it which language to write in. Without one they read `<html lang>`, so Admin,
 * which is written in Vietnamese, needs none.
 */
export function LocaleProvider({ locale, children }: { locale: string; children?: ReactNode }) {
  return createElement(LocaleContext.Provider, { value: locale }, children)
}

/** The locale shared components write in. */
export function useLocale() {
  return useContext(LocaleContext) ?? documentLocale()
}

/** The words of the current locale: `useLocaleText()(vietnamese, english)`. */
export function useLocaleText() {
  return localeText(useLocale())
}
