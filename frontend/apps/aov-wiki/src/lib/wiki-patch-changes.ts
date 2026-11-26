import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWikiContext, type WikiPatch } from "../context/wiki-context"
import { warehouseCatalogQuery } from "./warehouse-api"
import { warehouseName } from "./warehouse-types"
import { wikiCatalogParameters, type WikiCatalogScope } from "./wiki-catalog"
import { changeKind, changedSubjects, type PublishedChange } from "./published-change-subjects"
import type { WarehouseKind } from "./warehouse-types"
import { wikiGet, wikiGetAll, wikiGetPage, type WikiPage } from "./wiki-api"

/** Every query key of the shared patch change lists; reads and invalidation both use these. */
export const patchChangeKeys = {
  heroVariants: (scope: WikiCatalogScope, heroId: string) =>
    ["wiki", "hero-changed-variants", scope.region, scope.locale, heroId] as const,
  releases: (scope: WikiCatalogScope) => ["wiki", "releases", scope.region, scope.locale] as const,
  /** The versions of the region's ruleset whose patch page lists at least one change in a domain. */
  changedVariants: (scope: WikiCatalogScope, domain: ChangeDomain) =>
    ["wiki", "patch-changed-variants", scope.region, domain] as const,
  changes: (scope: WikiCatalogScope, domain: ChangeDomain, variant: Pick<WikiPatch, "id" | "patchId">) =>
    ["wiki", "patch-changes", scope.region, scope.locale, domain, variant.id, variant.patchId ?? "legacy"] as const,
  /** The pages after the first one of a patch with more changes than one page holds. */
  remaining: (scope: WikiCatalogScope, domain: ChangeDomain, variant: Pick<WikiPatch, "id" | "patchId">) =>
    [...patchChangeKeys.changes(scope, domain, variant), "remaining"] as const,
}

type Release = { id: string; variantId: string }
type ChangedVariants = { domain: ChangeDomain; variantIds: string[] }
export type ChangeDomain = "HERO" | "ITEM" | "ARCANA" | "ENCHANTMENT" | "SPELL"
const warehouseKinds = { ITEM: "items", ARCANA: "arcana", ENCHANTMENT: "enchantments", SPELL: "spells" } as const
export const warehouseChangeDomain = {
  items: "ITEM",
  arcana: "ARCANA",
  enchantments: "ENCHANTMENT",
  spells: "SPELL",
} as const satisfies Record<WarehouseKind, ChangeDomain>
const size = 20

const page = <T>(path: string, params: URLSearchParams, index: number, signal: AbortSignal): Promise<WikiPage<T>> =>
  wikiGetPage<T>(path, params, index, size, signal)

const pages = <T>(path: string, params: URLSearchParams, signal: AbortSignal, from = 0) =>
  wikiGetAll<T>(path, params, signal, { size, from })

export function useHeroChangedVariants(heroId: string) {
  const scope = useWikiContext()
  return useQuery({
    queryKey: patchChangeKeys.heroVariants(scope, heroId),
    queryFn: async ({ signal }) => {
      const history = await pages<PublishedChange>(
        `/heroes/${heroId}/changes`,
        wikiCatalogParameters(scope, false),
        signal,
      )
      return new Set(
        history
          .filter(changeKind)
          .map((row) => row.patchVariantId)
          .filter((id): id is string => !!id),
      )
    },
    staleTime: 60_000,
    retry: 1,
  })
}

/** Which versions to read: the ones the page shows, every one that changed the domain, or a single version. */
export type ChangeVersions = "shown" | "changed" | { variantId: string }

/**
 * The published changes of the versions `versions` names. One small list names the versions that changed the domain,
 * so the version menu can mark them without the page fetching every version's changes.
 */
export function usePublishedChanges(domain: ChangeDomain, versions: ChangeVersions = "shown") {
  const scope = useWikiContext()
  const client = useQueryClient()
  const variants = scope.options?.patches ?? []
  const params = wikiCatalogParameters(scope, false)
  const marks = useQuery({
    queryKey: patchChangeKeys.changedVariants(scope, domain),
    queryFn: ({ signal }) =>
      wikiGet<ChangedVariants>(
        `/patches/changed-variants?${new URLSearchParams({ region: scope.region, domain })}`,
        signal,
      ),
    staleTime: 60_000,
    retry: 1,
  })
  const marked = marks.data ? new Set(marks.data.variantIds) : undefined
  const shown = (variant: WikiPatch) =>
    scope.patchVariantId
      ? variant.id === scope.patchVariantId
      : scope.seasonId
        ? variant.seasonId === scope.seasonId
        : variant.isCurrent
  // A server without the list leaves every version to be read, as before it existed.
  const selected = variants.filter((variant) =>
    versions === "changed"
      ? marked
        ? marked.has(variant.id)
        : marks.isError
      : versions === "shown"
        ? shown(variant)
        : variant.id === versions.variantId,
  )
  const needsReleases = (domain === "HERO" || domain === "SPELL") && selected.some((patch) => !patch.patchId)
  const releases = useQuery({
    queryKey: patchChangeKeys.releases(scope),
    queryFn: ({ signal }) => pages<Release>("/patches", params, signal),
    enabled: needsReleases,
    staleTime: 60_000,
    retry: 1,
  })

  function endpoint(variant: WikiPatch) {
    const id = variant.patchId ?? releases.data?.find((r) => r.variantId === variant.id)?.id
    return id ? `/patches/${id}/changes` : undefined
  }
  function parameters(variant: WikiPatch) {
    const query = new URLSearchParams(params)
    query.set("domain", domain)
    if (variant.patchId) query.set("patchVariantId", variant.id)
    return query
  }
  const key = (variant: WikiPatch) => patchChangeKeys.changes(scope, domain, variant)
  const first = useQueries({
    queries: selected.map((variant) => ({
      queryKey: key(variant),
      enabled: !!variant.patchId || !needsReleases || releases.isSuccess,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const path = endpoint(variant)
        if (variant.patchId && path) return page<PublishedChange>(path, parameters(variant), 0, signal)

        // Older servers expose explicit hero changes and talent removals, plus published catalog snapshots.
        const rows =
          path && (domain === "HERO" || domain === "SPELL")
            ? await pages<PublishedChange>(path, parameters(variant), signal)
            : []
        if (domain !== "HERO") {
          const historic: WikiCatalogScope = {
            region: scope.region,
            locale: scope.locale,
            seasonId: variant.seasonId,
            patchVariantId: variant.id,
          }
          const entries = await client.fetchQuery(warehouseCatalogQuery(warehouseKinds[domain], historic))
          for (const entry of entries) {
            if (
              entry.revision.cause === "GAME_PATCH" &&
              entry.revision.effectiveFromPatchVariantId === variant.id &&
              !rows.some((row) => row.spellId === entry.id)
            ) {
              rows.push({
                subject: { id: entry.id, code: entry.code, displayName: warehouseName(entry, scope.locale) },
                changeKinds: ["UPDATED"],
              })
            }
          }
        }
        return { items: rows, totalElements: rows.length }
      },
      staleTime: 60_000,
      retry: 1,
    })),
  })
  const indexed = selected.map((variant, i) => ({ variant, result: first[i] }))
  const paginated = indexed.filter(
    ({ variant, result }) => variant.patchId && result?.data && result.data.totalElements > result.data.items.length,
  )
  const remainder = useQueries({
    queries: paginated.map(({ variant }) => ({
      queryKey: patchChangeKeys.remaining(scope, domain, variant),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        pages<PublishedChange>(endpoint(variant)!, parameters(variant), signal, 1),
      staleTime: 60_000,
      retry: 1,
    })),
  })
  const moreByVariant = new Map(paginated.map(({ variant }, i) => [variant.id, remainder[i]?.data ?? []]))
  const patches = indexed.map(({ variant, result }) => ({
    variant,
    rows: [...(result?.data?.items ?? []), ...(moreByVariant.get(variant.id) ?? [])],
  }))
  const errors = [...first, ...remainder].filter((query) => query.isError)
  return {
    subjects: changedSubjects(patches.flatMap(({ rows }) => rows)),
    patches,
    pending:
      scope.optionsPending ||
      (versions === "changed" && marks.isPending) ||
      (needsReleases && releases.isPending) ||
      [...first, ...remainder].some((q) => q.isPending && !q.isError && q.fetchStatus !== "idle"),
    // Without the list, only the versions read here can be marked.
    changedVariants:
      marked ??
      new Set(indexed.filter(({ result }) => result?.data?.items.some(changeKind)).map(({ variant }) => variant.id)),
    failed: (needsReleases && releases.isError) || errors.length > 0,
    retry: () => {
      if (marks.isError) void marks.refetch()
      if (needsReleases && releases.isError) void releases.refetch()
      for (const q of errors) void q.refetch()
    },
  }
}
