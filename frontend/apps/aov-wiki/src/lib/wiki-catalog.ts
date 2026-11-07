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
  const [, root = "", segment] = pathname.split("/")
  return root === "warehouse" ? `warehouse/${segment || tab || "items"}` : root
}

export const WAREHOUSE_TABS = ["items", "enchantments", "arcana", "spells"] as const

/** The armory's tab and entry live in the path because a static page cannot vary by query string. */
export function warehousePath(tab: string, entry?: string | null) {
  return `/warehouse/${tab}${entry ? `/${encodeURIComponent(entry)}` : ""}`
}

/** The same page without an open armory entry; every other path is returned unchanged. */
export function warehouseListPath(pathname: string) {
  const [, root, tab, entry] = pathname.split("/")
  return root === "warehouse" && tab && entry ? warehousePath(tab) : pathname
}

/** Links from before the tab and entry moved into the path keep opening the same view. */
export function legacyWarehouseTarget(search: string) {
  const params = new URLSearchParams(search)
  const requested = params.get("tab")
  const tab = WAREHOUSE_TABS.find((candidate) => candidate === requested) ?? "items"
  const path = warehousePath(tab, params.get("item"))
  params.delete("tab")
  params.delete("item")
  return params.size ? `${path}?${params}` : path
}

/** Moving between armory tabs and entries stays on one reading surface, so it must not reset the scroll position. */
export function wikiScrollKey(pathname: string) {
  return pathname.split("/")[1] === "warehouse" ? "/warehouse" : pathname
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
