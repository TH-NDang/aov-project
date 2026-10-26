export interface WikiCatalogScope {
  region: string
  locale: string
  seasonId?: string | null
  patchVariantId?: string | null
  includeUnscoped?: boolean
}

export function supportedWikiLocale(value: string | null | undefined) {
  return value === "en-US" ? "en-US" : "vi-VN"
}

export function wikiScopeKey(scope: WikiCatalogScope) {
  return [
    scope.region,
    scope.locale,
    scope.seasonId || "",
    scope.patchVariantId || "",
    !!scope.includeUnscoped,
  ] as const
}

export function wikiCatalogParameters(scope: WikiCatalogScope, historical = true) {
  const query = new URLSearchParams({ region: scope.region, locale: scope.locale })
  if (historical) {
    if (scope.seasonId) query.set("seasonId", scope.seasonId)
    if (scope.patchVariantId) query.set("patchVariantId", scope.patchVariantId)
    if ((scope.seasonId || scope.patchVariantId) && scope.includeUnscoped) query.set("includeUnscoped", "true")
  }
  return query
}

export function wikiScopeHref(path: string, scope: WikiCatalogScope) {
  const target = new URL(path, "https://wiki.invalid")
  const values = {
    region: scope.region,
    locale: scope.locale,
    season: scope.seasonId,
    patch: scope.patchVariantId,
    unscoped: scope.includeUnscoped ? "1" : null,
  }
  for (const [key, value] of Object.entries(values))
    if (value && !target.searchParams.has(key)) target.searchParams.set(key, value)
  return `${target.pathname}${target.search}${target.hash}`
}
