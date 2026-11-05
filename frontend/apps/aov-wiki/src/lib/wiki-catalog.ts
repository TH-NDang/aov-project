export interface WikiCatalogScope {
  region: string
  locale: string
  seasonId?: string | null
  patchVariantId?: string | null
  includeUnscoped?: boolean
  section?: string
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

export function wikiSection(pathname: string, tab: string | null) {
  if (pathname.replace(/\/$/, "") === "/warehouse") return `warehouse/${tab || "items"}`
  return pathname.split("/")[1] ?? ""
}

export function wikiScopeHref(path: string, scope: WikiCatalogScope) {
  if (!path.startsWith("/") || path.startsWith("//")) return path
  const target = new URL(path, "https://wiki.invalid")
  const sameSection =
    scope.section === undefined || scope.section === wikiSection(target.pathname, target.searchParams.get("tab"))
  const values = {
    region: scope.region,
    locale: scope.locale,
    season: sameSection && scope.seasonId,
    patch: sameSection && scope.patchVariantId,
    unscoped: sameSection && scope.includeUnscoped ? "1" : null,
  }
  for (const [key, value] of Object.entries(values))
    if (value && !target.searchParams.has(key)) target.searchParams.set(key, value)
  return `${target.pathname}${target.search}${target.hash}`
}
