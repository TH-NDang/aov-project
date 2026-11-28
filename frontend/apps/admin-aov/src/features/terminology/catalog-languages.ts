import type { EntityReference } from "@aov/ui/lib/entity-rich-text"

const languageNames = new Intl.DisplayNames(["vi"], { type: "language" })

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase()

/** The Vietnamese name of a language alone, without the country of the tag ("Thai" rather than "Thai (Thailand)"). */
export function catalogLanguageName(code: string) {
  const base = code.split("-")[0] ?? code
  try {
    return languageNames.of(base) || code
  } catch {
    return code
  }
}

/** The Vietnamese name of a language as the middle of a sentence writes it, with a lower-case first letter. */
export function catalogLanguageWord(code: string) {
  const name = catalogLanguageName(code)
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/** "TH" for th-TH, short enough for a row of marks. */
export function catalogLanguageCode(code: string) {
  return (code.split("-")[0] ?? code).toUpperCase()
}

/** An entry has a language when it has a name written in it; an empty translation does not count. */
export function hasCatalogLanguage(entity: EntityReference, code: string) {
  return entity.translations.some((text) => same(text.locale, code) && !!text.name.trim())
}

/**
 * The languages a list is kept in: every language one of its entries is named in, plus the one being read, in the
 * order of `order` and then any other tag. A language nobody writes in yet stays out, so it does not mark every row.
 */
export function catalogLanguages(entities: EntityReference[], order: string[], locale: string) {
  const present = new Map<string, string>()
  for (const code of [locale, ...entities.flatMap((entity) => entity.translations.map((text) => text.locale))]) {
    if (!present.has(code.toLowerCase())) present.set(code.toLowerCase(), code)
  }
  const known = order.filter((code) => present.has(code.toLowerCase()))
  const others = [...present.values()].filter((code) => !order.some((entry) => same(entry, code))).sort()
  return [...known, ...others]
}

/** How many entries lack a name in each language. */
export function catalogLanguageGaps(entities: EntityReference[], languages: string[]) {
  return languages.map((code) => ({
    code,
    count: entities.filter((entity) => !hasCatalogLanguage(entity, code)).length,
  }))
}
