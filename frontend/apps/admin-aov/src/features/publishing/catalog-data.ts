import type { Content, HeroGameplayChange, HeroRow, Revision } from "./types"
import type { PublicationOverview, Variant } from "./publication-overview"
import type { CatalogFilter } from "./catalog-context"

export function targetVariants(data: PublicationOverview, filter: CatalogFilter): Variant[] {
  if (filter.variantId) return data.variants.filter((v) => v.id === filter.variantId)
  if (!filter.seasonId) return []
  const season = data.seasons.find((s) => s.id === filter.seasonId)
  if (!season) return []
  const ids = new Set(data.variants.filter((v) => v.seasonId === season.id).map((v) => v.id))
  const result = new Map<string, Variant>()
  for (const v of data.variants.filter((v) => ids.has(v.id)))
    if (!result.has(v.rulesetId) || result.get(v.rulesetId)!.rulesetOrdinal < v.rulesetOrdinal)
      result.set(v.rulesetId, v)
  return [...result.values()]
}
export function selectCatalogRevisions(
  revisions: Revision[],
  data: PublicationOverview | undefined,
  filter: CatalogFilter,
  ruleset = "",
) {
  const targets = data ? targetVariants(data, filter) : []
  if ((filter.seasonId || filter.variantId) && !targets.length) return []
  const selected = new Map<string, Revision>()
  const ordinal = (r: Revision) =>
    data?.variants.find((v) => v.id === r.effectiveFromPatchVariantId)?.rulesetOrdinal ?? -1
  for (const r of revisions) {
    if (r.state === "DISCARDED" || (ruleset && r.rulesetId !== ruleset)) continue
    const target = targets.find((v) => v.rulesetId === r.rulesetId)
    if (targets.length && (!target || ordinal(r) < 0 || ordinal(r) > target.rulesetOrdinal)) continue
    const previous = selected.get(r.rulesetId)
    if (
      !previous ||
      ordinal(r) > ordinal(previous) ||
      (ordinal(r) === ordinal(previous) && r.revisionNo > previous.revisionNo)
    )
      selected.set(r.rulesetId, r)
  }
  return [...selected.values()]
}

export type HeroCatalogRow = HeroRow & {
  selectedRevision?: Revision
  changes: HeroGameplayChange[]
  rowKey: string
}

/** The server applies scope and search before pagination; rows group the returned changes by ruleset. */
export function heroCatalogRows(
  heroes: HeroRow[],
  data: PublicationOverview | undefined,
  filter: CatalogFilter,
  ruleset = "",
): HeroCatalogRow[] {
  const scoped = !!(filter.seasonId || filter.variantId)
  const ordinal = (change: HeroGameplayChange) =>
    data?.variants.find((variant) => variant.id === change.patchVariantId)?.rulesetOrdinal ?? -1
  return heroes.flatMap<HeroCatalogRow>((hero) => {
    const changes = (hero.gameplayChanges ?? [])
      .filter(
        (change) =>
          (!ruleset || change.rulesetId === ruleset) &&
          (!filter.seasonId || change.seasonId === filter.seasonId) &&
          (!filter.variantId || change.patchVariantId === filter.variantId),
      )
      .sort((a, b) => ordinal(b) - ordinal(a))
    const revisions = scoped
      ? [...new Set(changes.map((change) => change.rulesetId))].flatMap((rule) => {
          const latest = changes.find((change) => change.rulesetId === rule)!
          const revision = hero.revisions.find((item) => item.id === latest.toHeroRevisionId)
          return revision ? [revision] : []
        })
      : selectCatalogRevisions(hero.revisions, data, { seasonId: "", variantId: "" }, ruleset)
    if (!revisions.length) return scoped || ruleset ? [] : [{ ...hero, changes: [], rowKey: hero.id }]
    return revisions.map((selectedRevision) => ({
      ...hero,
      selectedRevision,
      changes: changes.filter((change) => change.rulesetId === selectedRevision.rulesetId),
      rowKey: `${hero.id}:${selectedRevision.rulesetId}`,
    }))
  })
}

type TranslationField = "name" | "title" | "summary" | "lore" | "description" | "acquisitionNote"
export function translationCoverage(content: Content, locales: string[]) {
  const groups: {
    translations: ({ locale: string } & Partial<Record<TranslationField, string | null>>)[]
    required: TranslationField[]
    optional: TranslationField[]
  }[] = [
    { translations: content.PROFILE?.translations ?? [], required: ["name"], optional: ["title", "summary", "lore"] },
    ...(content.SKILLS?.skills ?? []).map((s) => ({
      translations: s.translations,
      required: ["name", "description"] as TranslationField[],
      optional: [],
    })),
    ...(content.SKINS?.skins ?? []).map((s) => ({
      translations: s.translations,
      required: ["name"] as TranslationField[],
      optional: ["description", "acquisitionNote"] as TranslationField[],
    })),
  ]
  const filled = (v: unknown) => typeof v === "string" && !!v.trim()
  return locales.map((locale) => {
    let total = 0,
      completed = 0
    for (const group of groups) {
      const fields = [
        ...group.required,
        ...group.optional.filter((key) => group.translations.some((t) => filled(t[key]))),
      ]
      total += fields.length
      const translation = group.translations.find((t) => t.locale === locale)
      completed += fields.filter((key) => filled(translation?.[key])).length
    }
    return { locale, completed, total, complete: total > 0 && completed === total }
  })
}

export function appliedMarkets(revisions: Revision[], selected: Revision, data: PublicationOverview) {
  if (selected.state !== "PUBLISHED") return []
  const ordinal = (r: Revision) =>
    data.variants.find((v) => v.id === r.effectiveFromPatchVariantId)?.rulesetOrdinal ?? -1
  return data.markets.flatMap((m) => {
    const release = data.releases.find((r) => r.id === m.currentReleaseId)
    const variant = data.variants.find((v) => v.id === release?.variantId)
    if (!variant || variant.rulesetId !== selected.rulesetId) return []
    const current = revisions
      .filter(
        (r) =>
          r.state === "PUBLISHED" &&
          r.rulesetId === variant.rulesetId &&
          (!r.publishedAt || Date.parse(r.publishedAt) <= Date.parse(data.asOf)) &&
          ordinal(r) <= variant.rulesetOrdinal,
      )
      .sort((a, b) => ordinal(b) - ordinal(a) || b.revisionNo - a.revisionNo)[0]
    return current?.id === selected.id ? [{ market: m, release: release!, variant }] : []
  })
}
