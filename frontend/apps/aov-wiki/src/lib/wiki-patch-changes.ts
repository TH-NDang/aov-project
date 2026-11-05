import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWikiContext, type WikiPatch } from "../context/wiki-context"
import { warehouseCatalogQuery } from "../features/warehouse/warehouse-api"
import { warehouseName } from "../features/warehouse/warehouse-types"
import { wikiCatalogParameters, type WikiCatalogScope } from "./wiki-catalog"
import { changeKind, changedSubjects, type PublishedChange } from "./published-change-subjects"
import type { WarehouseKind } from "../features/warehouse/warehouse-types"

type Release = { id: string; variantId: string }
export type ChangeDomain = "HERO" | "ITEM" | "ARCANA" | "ENCHANTMENT" | "SPELL"
const warehouseKinds = { ITEM: "items", ARCANA: "arcana", ENCHANTMENT: "enchantments", SPELL: "spells" } as const
export const warehouseChangeDomain = {
  items: "ITEM",
  arcana: "ARCANA",
  enchantments: "ENCHANTMENT",
  spells: "SPELL",
} as const satisfies Record<WarehouseKind, ChangeDomain>
type Slice<T> = { items: T[]; totalElements: number }
const size = 20

async function page<T>(path: string, params: URLSearchParams, index: number, signal: AbortSignal): Promise<Slice<T>> {
  const query = new URLSearchParams(params)
  query.set("page", String(index))
  query.set("size", String(size))
  const response = await fetch(`/api/wiki/v1${path}?${query}`, { credentials: "omit", signal })
  if (!response.ok) throw new Error("Published patch changes could not be loaded.")
  return response.json()
}

async function pages<T>(path: string, params: URLSearchParams, signal: AbortSignal, start = 0) {
  const items: T[] = []
  for (let index = start; ; index++) {
    const result = await page<T>(path, params, index, signal)
    items.push(...result.items)
    if (!result.items.length || (index + 1) * size >= result.totalElements) return items
  }
}

export function useHeroChangedVariants(heroId: string) {
  const scope = useWikiContext()
  return useQuery({
    queryKey: ["wiki", "hero-changed-variants", scope.region, scope.locale, heroId],
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

export function usePublishedChanges(domain: ChangeDomain, includeAllPatches = false) {
  const scope = useWikiContext()
  const client = useQueryClient()
  const variants = scope.options?.patches ?? []
  const params = wikiCatalogParameters(scope, false)
  const needsReleases = (domain === "HERO" || domain === "SPELL") && variants.some((patch) => !patch.patchId)
  const releases = useQuery({
    queryKey: ["wiki", "releases", scope.region, scope.locale],
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
  const key = (variant: WikiPatch) => [
    "wiki",
    "patch-changes",
    scope.region,
    scope.locale,
    domain,
    variant.id,
    variant.patchId ?? "legacy",
  ]
  const first = useQueries({
    queries: variants.map((variant) => ({
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
      refetchOnWindowFocus: "always" as const,
      retry: 1,
    })),
  })
  const indexed = variants.map((variant, i) => ({ variant, result: first[i] }))
  const selected = indexed.filter(
    ({ variant }) =>
      includeAllPatches ||
      (scope.patchVariantId
        ? variant.id === scope.patchVariantId
        : scope.seasonId
          ? variant.seasonId === scope.seasonId
          : variant.isCurrent),
  )
  const paginated = selected.filter(
    ({ variant, result }) => variant.patchId && result?.data && result.data.totalElements > result.data.items.length,
  )
  const remainder = useQueries({
    queries: paginated.map(({ variant }) => ({
      queryKey: [...key(variant), "remaining"],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        pages<PublishedChange>(endpoint(variant)!, parameters(variant), signal, 1),
      staleTime: 60_000,
      refetchOnWindowFocus: "always" as const,
      retry: 1,
    })),
  })
  const moreByVariant = new Map(paginated.map(({ variant }, i) => [variant.id, remainder[i]?.data ?? []]))
  const patches = selected.map(({ variant, result }) => ({
    variant,
    rows: [...(result?.data?.items ?? []), ...(moreByVariant.get(variant.id) ?? [])],
  }))
  const errors = [...first, ...remainder].filter((query) => query.isError)
  return {
    subjects: changedSubjects(patches.flatMap(({ rows }) => rows)),
    patches,
    pending:
      scope.optionsPending ||
      (needsReleases && releases.isPending) ||
      [...first, ...remainder].some((q) => q.isPending && !q.isError && q.fetchStatus !== "idle"),
    changedVariants: new Set(
      indexed.filter(({ result }) => result?.data?.items.some(changeKind)).map(({ variant }) => variant.id),
    ),
    failed: (needsReleases && releases.isError) || errors.length > 0,
    retry: () => {
      if (needsReleases && releases.isError) void releases.refetch()
      for (const q of errors) void q.refetch()
    },
  }
}
