/** English, the first locale a reader falls back to after the one they asked for. */
export const ENGLISH_LOCALE = "en-US"

/** Vietnamese, the language content is written in first and the locale the apps read by default. */
export const DEFAULT_LOCALE = "vi-VN"

/**
 * The locales a reader falls back through, best first: the requested locale, then English, then Vietnamese.
 * wiki-service picks translations in the same order (`CatalogLocales.fallbackOrder`).
 */
export function fallbackOrder(requested?: string | null): string[] {
  return [...new Set([requested, ENGLISH_LOCALE, DEFAULT_LOCALE].filter((locale): locale is string => !!locale))]
}

/**
 * The translation a reader of `requested` sees: that locale, then English, then Vietnamese, then the first remaining
 * translation by locale code, so the choice does not depend on the order the translations were written in.
 */
export function pickTranslation<T extends { locale: string }>(
  translations: readonly T[] | null | undefined,
  requested?: string | null,
): T | undefined {
  if (!translations?.length) return undefined
  for (const locale of fallbackOrder(requested)) {
    const found = translations.find((text) => text.locale === locale)
    if (found) return found
  }
  return translations.reduce((first, text) => (text.locale < first.locale ? text : first))
}
