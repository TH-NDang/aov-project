import { itemStatDefinitionByCode } from "@aov/ui/lib/item-description"

/** One text field of a translation, as it was and as the draft writes it; null where it is absent. */
export interface TextChange {
  label: string
  before: string | null
  after: string | null
}

/** What a draft does to one language: adds it, removes it, or changes some of its fields. */
export interface LanguageChange {
  locale: string
  kind: "added" | "removed" | "changed"
  fields: TextChange[]
}

type Translation = {
  locale: string
  name?: string | null
  summary?: string | null
  description?: string | null
  statLabels?: Record<string, string>
  variantLabels?: Record<string, string>
  effects?: { key: string; name?: string | null; description?: string | null }[]
}
type Form = { key: string; translations?: Translation[] } & Record<string, unknown>
type Content = { translations?: Translation[]; states?: Form[] } & Record<string, unknown>

/** A stat code under its shared Vietnamese name, so a label reads as the game names the stat rather than as its code. */
const statName = (code: string) => itemStatDefinitionByCode(code)?.vi ?? code

/**
 * Every text a language holds for an entry, one labelled field each: its own name and text, the names of its stats
 * and forms, its effects, and the names of its forms' translations. Empty fields are left out.
 */
function languageFields(content: Content, locale: string, formNames: Map<string, string>): Map<string, string> {
  const fields = new Map<string, string>()
  const put = (label: string, value: string | null | undefined) => {
    if (value?.trim()) fields.set(label, value)
  }
  const own = content.translations?.find((translation) => translation.locale === locale)
  if (own) {
    put("Tên", own.name)
    put("Tóm tắt", own.summary)
    put("Mô tả", own.description)
    for (const [code, label] of Object.entries(own.statLabels ?? {})) put(`Tên chỉ số · ${statName(code)}`, label)
    for (const [key, label] of Object.entries(own.variantLabels ?? {})) put(`Tên biến thể · ${key}`, label)
    for (const effect of own.effects ?? []) {
      put(`Hiệu ứng · ${effect.key} · Tên`, effect.name)
      put(`Hiệu ứng · ${effect.key} · Mô tả`, effect.description)
    }
  }
  for (const form of content.states ?? []) {
    const text = form.translations?.find((translation) => translation.locale === locale)
    const formName = formNames.get(form.key) ?? form.key
    put(`Dạng · ${formName} · Tên`, text?.name)
    put(`Dạng · ${formName} · Mô tả`, text?.description)
  }
  return fields
}

/** The languages an entry is written in, its own and its forms'. */
function languages(content: Content) {
  return new Set([
    ...(content.translations ?? []).map((translation) => translation.locale),
    ...(content.states ?? []).flatMap((form) => (form.translations ?? []).map((translation) => translation.locale)),
  ])
}

/**
 * What a draft does to each language, the reading language first: the languages it adds, those it removes, and in the
 * others the fields it changes. A language it leaves alone is not listed.
 */
export function languageChanges(before: Content, after: Content, readingLocale: string): LanguageChange[] {
  const had = languages(before)
  const has = languages(after)
  // A form is named in the reading language, from the draft first, so its label stays the same on both sides.
  const formNames = new Map<string, string>()
  for (const form of [...(before.states ?? []), ...(after.states ?? [])]) {
    const name = form.translations?.find((translation) => translation.locale === readingLocale)?.name
    if (name) formNames.set(form.key, name)
  }
  const changes: LanguageChange[] = []
  for (const locale of new Set([...had, ...has])) {
    const old = languageFields(before, locale, formNames)
    const next = languageFields(after, locale, formNames)
    if (!had.has(locale) || (!old.size && next.size)) {
      changes.push({
        locale,
        kind: "added",
        fields: [...next].map(([label, value]) => ({ label, before: null, after: value })),
      })
      continue
    }
    if (!has.has(locale) || (old.size && !next.size)) {
      changes.push({
        locale,
        kind: "removed",
        fields: [...old].map(([label, value]) => ({ label, before: value, after: null })),
      })
      continue
    }
    const fields = [...new Set([...old.keys(), ...next.keys()])]
      .filter((label) => old.get(label) !== next.get(label))
      .map((label) => ({ label, before: old.get(label) ?? null, after: next.get(label) ?? null }))
    if (fields.length) changes.push({ locale, kind: "changed", fields })
  }
  return changes.sort(
    (a, b) =>
      Number(b.locale === readingLocale) - Number(a.locale === readingLocale) || a.locale.localeCompare(b.locale),
  )
}

/**
 * The data of a draft as a reader compares it, its texts left to {@link languageChanges}: stats under their shared
 * names with their units instead of as numbered rows, and forms without their translations.
 */
export function comparableData(content: Content): Record<string, unknown> {
  const { translations: _translations, ...data } = content
  const states = Array.isArray(data.states) ? data.states.map(({ translations: _texts, ...form }) => form) : data.states
  const stats = data.stats
  return {
    ...data,
    ...(states !== undefined ? { states } : {}),
    ...(Array.isArray(stats)
      ? {
          stats: Object.fromEntries(
            stats.map((stat: { key: string; value: number; unit: string | null }) => [
              statName(stat.key),
              `${stat.value}${stat.unit === "%" || stat.unit === "PERCENT" ? "%" : ""}`,
            ]),
          ),
        }
      : {}),
  }
}

/** A piece of a changed text: kept as it was, removed by the draft, or added by it. */
export interface TextPiece {
  kind: "same" | "removed" | "added"
  text: string
}

/**
 * The words two versions of a text share and where they differ, so a one-word fix in a long description shows as that
 * word. Words are compared with the spaces and line breaks after them; the longest common run of words is kept.
 */
export function wordDiff(before: string, after: string): TextPiece[] {
  const split = (text: string) => text.match(/\S+\s*|\s+/g) ?? []
  const a = split(before)
  const b = split(after)
  const same = (x: string, y: string) => x.trimEnd() === y.trimEnd()
  const longest = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      longest[i][j] = same(a[i], b[j]) ? longest[i + 1][j + 1] + 1 : Math.max(longest[i + 1][j], longest[i][j + 1])
  const pieces: TextPiece[] = []
  const push = (kind: TextPiece["kind"], text: string) => {
    const last = pieces.at(-1)
    if (last?.kind === kind) last.text += text
    else pieces.push({ kind, text })
  }
  let i = 0
  let j = 0
  // Where either way keeps as much, the old words go first, so a replacement reads as removed, then added.
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && same(a[i], b[j])) {
      push("same", b[j])
      i++
      j++
    } else if (i < a.length && (j === b.length || longest[i + 1][j] >= longest[i][j + 1])) push("removed", a[i++])
    else push("added", b[j++])
  }
  return pieces
}
