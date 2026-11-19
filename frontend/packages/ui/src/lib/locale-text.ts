/** Chooses between the Vietnamese and the English words of one piece of interface text. */
export type LocaleText = (vietnamese: string, english: string) => string

/** True for an English locale such as "en" or "en-US". Every other locale reads Vietnamese, the product's language. */
export const isEnglishLocale = (locale: string | null | undefined) => !!locale && /^en\b/i.test(locale)

/**
 * The words of a locale: `localeText("en-US")(vietnamese, english)` gives the English words. Apps and shared
 * components call this instead of writing the same vi/en test again.
 */
export const localeText =
  (locale: string | null | undefined): LocaleText =>
  (vietnamese, english) =>
    isEnglishLocale(locale) ? english : vietnamese

/** The language the page is written in, from `<html lang>`, which every app keeps in step with its choice. */
export const documentLocale = () => (typeof document !== "undefined" && document.documentElement.lang) || "vi-VN"

const MARKETS: Record<string, [string, string]> = {
  VN: ["Việt Nam", "Vietnam"],
  TH: ["Thái Lan", "Thailand"],
  TW: ["Đài Loan", "Taiwan"],
  ID: ["Indonesia", "Indonesia"],
  GLOBAL: ["Toàn cầu", "Global"],
}

/**
 * A game market's name in the reader's language. A name the service sent wins in Vietnamese, the language services
 * write; an unknown market keeps that name or its code.
 */
export function marketName(code: string, locale: string | null | undefined, given?: string | null) {
  const known = MARKETS[code]
  if (isEnglishLocale(locale)) return known?.[1] ?? given ?? code
  return given || known?.[0] || code
}
