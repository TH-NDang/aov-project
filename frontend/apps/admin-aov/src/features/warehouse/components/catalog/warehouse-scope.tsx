import {
  activeCatalogScope,
  catalogScopePatch,
  draftInCatalogScope,
  showAllCatalogEntries,
} from "../../../publishing/model/catalog/catalog-scope"
import { useCallback, useMemo } from "react"
import { useCatalogScopePreference } from "../../../publishing/components/catalog/catalog-scope-memory"
import { useSearchParams } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { type CatalogFilter } from "../../../publishing/components/catalog/catalog-context"
import { CatalogTimeline } from "../../../publishing/components/catalog/catalog-timeline"
import { usePublicationOverview, type PublicationOverview } from "../../../publishing/api/publication-overview"
import { errorMessage, isApiError } from "@/lib/api/errors"
import { Button } from "@aov/ui/components/button"
import { useSearchParam } from "@/hooks/use-search-param"
import { useWarehouseCatalog, warehouseApi, warehouseKeys } from "../../api/warehouse-api"
import {
  useCatalogChanges,
  changeCounts,
  scopedChanges,
  isGameplayChange,
  type CatalogBadgeKind,
} from "../history/catalog-changes"
import type { WarehouseEntry } from "../../model/warehouse-types"
import type { WarehouseKind } from "@aov/ui/lib/warehouse-content"

function appendVisibleDrafts<T extends WarehouseEntry>(
  rows: T[],
  drafts: T[],
  scope: CatalogFilter,
  variants: PublicationOverview["variants"],
) {
  const existing = new Set(rows.map((entry) => entry.id))
  return [
    ...rows,
    ...drafts.filter(
      ({ id, revision }) =>
        !existing.has(id) && draftInCatalogScope(revision.effectiveFromPatchVariantId, scope, variants),
    ),
  ]
}

const names: Record<WarehouseKind, string> = {
  items: "trang bị",
  enchantments: "phù hiệu",
  spells: "phụ trợ",
  arcana: "ngọc",
}

export function useWarehouseScope<K extends WarehouseKind>(kind: K, rulesetId: string, locale: string) {
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const requested: CatalogFilter = { seasonId: params.get("season") ?? "", variantId: params.get("patch") ?? "" }
  const showAll = showAllCatalogEntries(params)
  const overview = usePublicationOverview()
  const catalog = useWarehouseCatalog(kind, rulesetId, locale)
  const draftQuery = useQuery({
    queryKey: warehouseKeys.drafts(kind, rulesetId, locale),
    queryFn: async ({ signal }) => {
      try {
        return await warehouseApi.list(kind, rulesetId, locale, signal, { draftsOnly: true })
      } catch (error) {
        // Older servers can still expose drafts through the unscoped catalog.
        if (
          isApiError(error, "INVALID_QUERY_PARAMETER") &&
          error.problem.errors?.some((field) => field.path === "draftsOnly" && field.code === "UNKNOWN_PARAMETER")
        )
          return null
        throw error
      }
    },
    enabled: !!rulesetId,
    staleTime: 60000,
  })
  const drafts = useMemo(
    () => draftQuery.data ?? (catalog.data ?? []).filter((entry) => entry.revision.state === "DRAFT"),
    [draftQuery.data, catalog.data],
  )
  const data = useMemo(
    () =>
      overview.data
        ? {
            ...overview.data,
            rulesets: overview.data.rulesets.filter((r) => r.id === rulesetId),
            seasons: overview.data.seasons.filter((s) =>
              overview.data!.variants.some((v) => v.rulesetId === rulesetId && v.seasonId === s.id),
            ),
            variants: overview.data.variants.filter((v) => v.rulesetId === rulesetId),
          }
        : undefined,
    [overview.data, rulesetId],
  )
  const currentFilter = data && activeCatalogScope(data)
  const preferred = useCatalogScopePreference(data, requested)
  const chosen = preferred.seasonId || preferred.variantId ? preferred : (currentFilter ?? preferred)
  // One object per scope, so what is worked out from it follows the scope and not each render's copy.
  const value = useMemo<CatalogFilter>(
    () => ({ seasonId: chosen.seasonId, variantId: chosen.variantId }),
    [chosen.seasonId, chosen.variantId],
  )
  const scoped = !!(value.seasonId || value.variantId)
  const changes = useCatalogChanges(kind, rulesetId, locale)
  const onChange = (next: CatalogFilter) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        copy.delete("scope")
        for (const [key, value] of Object.entries(catalogScopePatch(next)))
          if (value) copy.set(key, value)
          else copy.delete(key)
        copy.delete("group")
        return copy
      },
      { replace: true, preventScrollReset: true },
    )
  const matched = useMemo(() => scopedChanges(changes.data ?? [], data, value), [changes.data, data, value])
  const latest = useMemo(() => {
    const result = new Map<string, (typeof matched)[number]>()
    for (const change of matched.filter(isGameplayChange)) {
      const old = result.get(change.ownerId)
      const ordinal = (id: string) => data?.variants.find((v) => v.id === id)?.rulesetOrdinal ?? 0
      if (!old || ordinal(change.patchVariantId) > ordinal(old.patchVariantId)) result.set(change.ownerId, change)
    }
    return result
  }, [matched, data])
  const query = useQuery({
    queryKey: warehouseKeys.scope(kind, rulesetId, locale, value.seasonId, value.variantId, showAll),
    queryFn: async ({ signal }) => {
      const filter = {
        seasonId: value.seasonId,
        patchVariantId: value.variantId,
        includeUnchanged: showAll,
      }
      const includeUnscoped = showAll && (kind === "items" || kind === "spells")
      try {
        return await warehouseApi.list(kind, rulesetId, locale, signal, { ...filter, includeUnscoped })
      } catch (error) {
        if (
          !includeUnscoped ||
          !isApiError(error, "INVALID_QUERY_PARAMETER") ||
          !error.problem.errors?.some((field) => field.path === "includeUnscoped" && field.code === "UNKNOWN_PARAMETER")
        )
          throw error
        // Older servers expose undated publications only in the full catalog.
        const [rows, all] = await Promise.all([
          warehouseApi.list(kind, rulesetId, locale, signal, filter),
          client.fetchQuery({
            queryKey: warehouseKeys.catalog(kind, rulesetId, locale),
            queryFn: ({ signal }) => warehouseApi.list(kind, rulesetId, locale, signal),
            staleTime: 60000,
          }),
        ])
        const existing = new Set(rows.map((entry) => entry.id))
        return [
          ...rows,
          ...all.filter(
            ({ id, revision }) =>
              !existing.has(id) && revision.state === "PUBLISHED" && revision.effectiveFromPatchVariantId === null,
          ),
        ]
      }
    },
    select: (rows) => (showAll ? rows : rows.filter((row) => latest.has(row.id))),
    enabled: scoped && !!rulesetId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  })
  const variants =
    data?.variants.filter(
      (v) => (!value.seasonId || v.seasonId === value.seasonId) && (!value.variantId || v.id === value.variantId),
    ) ?? []
  const entries = useMemo(() => {
    if (!scoped) return catalog.data ?? []
    const rows = query.data ?? []
    return showAll ? appendVisibleDrafts(rows, drafts, value, data?.variants ?? []) : rows
  }, [scoped, showAll, catalog.data, query.data, drafts, value, data?.variants])
  const reviewed = variants.length > 0 && variants.every((v) => v.dataReviewState === "COMPLETE")
  const baselineIds = useMemo(
    () => new Set(matched.filter((row) => !isGameplayChange(row)).map((row) => row.ownerId)),
    [matched],
  )
  const badgeKinds = useCallback(
    ({ id, revision }: WarehouseEntry): CatalogBadgeKind[] => {
      if (revision.state === "DRAFT" && showAll) return []
      const kinds = latest.get(id)?.kinds
      if (kinds) return kinds
      if (baselineIds.has(id) || !revision.effectiveFromPatchVariantId) return []
      return scoped && showAll ? [reviewed ? "UNCHANGED" : "INHERITED"] : []
    },
    [showAll, latest, baselineIds, scoped, reviewed],
  )
  return {
    kind,
    catalog,
    drafts,
    draftQuery,
    draftsReady: draftQuery.isSuccess && (draftQuery.data !== null || catalog.isSuccess),
    entries,
    currentFilter,
    value,
    scoped,
    overview,
    changes,
    query,
    data,
    onChange,
    baselineIds,
    reviewed,
    latest,
    showAll,
    badgeKinds,
  }
}
export type WarehouseScopeState = ReturnType<typeof useWarehouseScope>
export function WarehouseScopeControls({ scope }: { scope: WarehouseScopeState }) {
  const counts = changeCounts(scope.changes.data ?? [])
  for (const variant of scope.data?.variants ?? [])
    if (!counts.has(variant.id)) counts.set(variant.id, { changes: 0, baseline: 0 })
  return (
    <div className="min-w-0 space-y-3">
      {scope.data && (
        <CatalogTimeline
          allLabel={`Tất cả ${names[scope.kind]}`}
          currentFilter={scope.currentFilter}
          data={scope.data}
          value={scope.value}
          onChange={scope.onChange}
          counts={scope.changes.isError ? undefined : counts}
          loading={scope.changes.isPending}
        />
      )}
      {(scope.overview.error || scope.changes.error || scope.draftQuery.error) && (
        <div role="alert" className="text-sm text-destructive">
          {errorMessage(scope.overview.error ?? scope.changes.error ?? scope.draftQuery.error)}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void scope.overview.refetch()
              void scope.changes.refetch()
              void scope.draftQuery.refetch()
            }}
          >
            Thử lại
          </Button>
        </div>
      )}
    </div>
  )
}

export function WarehouseScopeEmpty({ scope, filtered = false }: { scope: WarehouseScopeState; filtered?: boolean }) {
  const [, setShow] = useSearchParam("show")
  const name = names[scope.kind]
  const patch = scope.data?.variants.find((entry) => entry.id === scope.value.variantId)
  const season = scope.data?.seasons.find((entry) => entry.id === scope.value.seasonId)
  const period = patch ? `patch ${patch.patchCode}` : season ? `mùa ${season.displayName}` : "mốc đã chọn"
  const message = filtered
    ? `Không tìm thấy ${name} phù hợp với bộ lọc hiện tại.`
    : scope.showAll
      ? `Chưa có dữ liệu ${name} đã xuất bản tại ${period}.`
      : `Chưa ghi nhận thay đổi về ${name} trong ${period}.`
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-6">
      <p role="status" className="type-body text-muted-foreground">
        {message}
      </p>
      {!filtered && !scope.showAll && (
        <Button type="button" size="sm" variant="outline" onClick={() => setShow("all")}>
          Xem tất cả {name}
        </Button>
      )}
    </div>
  )
}
