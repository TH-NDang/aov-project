import type { EntityReference, RichTextSettings } from "@aov/ui/lib/entity-rich-text"

export function normalizeHeroAliases(values: string[]): string[] {
  const result = new Map<string, string>()
  for (const value of values) {
    const name = value.normalize("NFC").trim()
    if (name && !result.has(name.toLowerCase())) result.set(name.toLowerCase(), name)
  }
  return [...result.values()]
}

/** Hero catalog text stays authoritative; saved translations contribute locale-specific aliases only. */
export function mergeReferenceEntry(original: EntityReference | undefined, custom: EntityReference): EntityReference {
  const merged = { ...original, ...custom, iconAssetId: original?.iconAssetId }
  if (!original || original.kind !== "hero") return merged

  const saved = new Map(custom.translations.map((text) => [text.locale.toLowerCase(), text.aliases]))
  return {
    ...merged,
    translations: original.translations.map((text) => ({
      ...text,
      aliases: normalizeHeroAliases([...text.aliases, ...(saved.get(text.locale.toLowerCase()) ?? [])]),
    })),
  }
}

export function mergeReferenceCatalog(
  originals: EntityReference[],
  custom: EntityReference[],
  includeUnavailable = false,
) {
  const entries = new Map(originals.map((entity) => [`${entity.kind}:${entity.id}`, entity]))
  for (const entity of custom) {
    const key = `${entity.kind}:${entity.id}`
    if (entity.kind === "term" || entries.has(key) || includeUnavailable)
      entries.set(key, mergeReferenceEntry(entries.get(key), entity))
  }
  return [...entries.values()]
}

export function updateHeroAliases(
  settings: RichTextSettings,
  canonical: EntityReference,
  updates: { locale: string; aliases: string[] }[],
): RichTextSettings {
  if (canonical.kind !== "hero") throw new Error("Alias-only updates require a canonical hero reference")
  const existing = settings.entities.find((entity) => entity.kind === "hero" && entity.id === canonical.id)
  const translations = new Map((existing?.translations ?? []).map((text) => [text.locale.toLowerCase(), text]))
  for (const update of updates) {
    const text = canonical.translations.find((text) => text.locale.toLowerCase() === update.locale.toLowerCase())
    if (!text) throw new Error("Alias locale is not available in the canonical hero catalog")
    const aliases = normalizeHeroAliases(update.aliases)
    if (aliases.length > 20 || aliases.some((alias) => alias.length > 200)) throw new Error("Invalid hero aliases")
    if (aliases.length) translations.set(text.locale.toLowerCase(), { ...text, aliases })
    else translations.delete(text.locale.toLowerCase())
  }

  const hasPresentation =
    existing &&
    (existing.icon != null ||
      existing.autoMatch !== undefined ||
      existing.display !== undefined ||
      existing.destinations !== undefined)
  if (!translations.size && hasPresentation) {
    const text = canonical.translations[0]
    if (text) translations.set(text.locale.toLowerCase(), { ...text, aliases: [] })
  }
  const entities = settings.entities.filter((entity) => entity.kind !== "hero" || entity.id !== canonical.id)
  if (translations.size)
    entities.push({ ...existing, id: canonical.id, kind: "hero", translations: [...translations.values()] })
  return { ...settings, entities }
}
