import { useQuery } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import type { Request } from "../publishing/publishing-api"
import type { PageSlice } from "../publishing/types"
import type {
  WarehouseContents,
  WarehouseEntry,
  WarehouseKind,
  WarehouseMetadata,
  WarehouseRevision,
  EnchantmentContent,
  SpellRemoval,
} from "./warehouse-types"

export const warehouseKeys = {
  all: ["warehouse"] as const,
  catalog: (kind: WarehouseKind, rulesetId: string, locale: string) => ["warehouse", kind, rulesetId, locale] as const,
  metadata: (kind: "items" | "enchantments") => ["warehouse", "metadata", kind] as const,
}
export interface WarehouseScope {
  seasonId?: string
  patchVariantId?: string
  includeUnchanged?: boolean
}
export function createWarehouseApi(request: Request = backendRequest) {
  const send = <T>(path: string, method: string, body: unknown) =>
    request<T>(path, { method, body: JSON.stringify(body) })
  return {
    async list<K extends WarehouseKind>(
      kind: K,
      rulesetId: string,
      locale: string,
      signal?: AbortSignal,
      scope?: WarehouseScope,
    ) {
      const rows: WarehouseEntry<WarehouseContents[K]>[] = []
      let page = 0
      while (true) {
        const params = new URLSearchParams({ rulesetId, locale, page: String(page), size: "100" })
        if (scope?.includeUnchanged) params.set("includeUnchanged", "true")
        if (scope?.seasonId) params.set("seasonId", scope.seasonId)
        if (scope?.patchVariantId) params.set("patchVariantId", scope.patchVariantId)
        const slice = await request<PageSlice<WarehouseEntry<WarehouseContents[K]>>>(`/admin/${kind}?${params}`, {
          signal,
        })
        rows.push(...slice.items)
        if (!slice.items.length || rows.length >= slice.totalElements) return rows
        page++
      }
    },
    read: <K extends WarehouseKind>(kind: K, id: string, revisionId: string) =>
      request<WarehouseEntry<WarehouseContents[K]>>(`/admin/${kind}/${id}/revisions/${revisionId}`),
    revisions: (kind: WarehouseKind, id: string) => request<WarehouseRevision[]>(`/admin/${kind}/${id}/revisions`),
    create: <K extends WarehouseKind>(
      kind: K,
      value: {
        code: string
        rulesetId: string
        initialLocale: string
        name: string
        content: WarehouseContents[K]
        effectiveFromPatchVariantId?: string | null
      },
    ) => send<WarehouseEntry<WarehouseContents[K]>>(`/admin/${kind}`, "POST", value),
    save: <K extends WarehouseKind>(
      kind: K,
      entry: WarehouseEntry<WarehouseContents[K]>,
      content: WarehouseContents[K],
      effectiveFromPatchVariantId?: string,
    ) =>
      send<WarehouseEntry<WarehouseContents[K]>>(`/admin/${kind}/${entry.id}/drafts/${entry.revision.id}`, "PUT", {
        expectedVersion: entry.revision.version,
        content,
        ...(effectiveFromPatchVariantId ? { effectiveFromPatchVariantId } : {}),
        ...(kind === "spells" &&
        entry.revision.effectiveFromPatchVariantId &&
        !effectiveFromPatchVariantId &&
        "legacy" in content &&
        content.legacy &&
        "availability" in content &&
        content.availability === "REMOVED"
          ? { clearPatchContext: true }
          : {}),
        changeNote: "Update catalog content",
      }),
    fork: <K extends WarehouseKind>(
      kind: K,
      entry: WarehouseEntry<WarehouseContents[K]>,
      cause = "CONTENT_CORRECTION",
      patchVariantId?: string,
    ) =>
      send<WarehouseEntry<WarehouseContents[K]>>(`/admin/${kind}/${entry.id}/drafts`, "POST", {
        rulesetId: entry.revision.rulesetId,
        sourceRevisionId: entry.revision.id,
        cause,
        effectiveFromPatchVariantId: patchVariantId ?? null,
        changeNote: "Create working copy",
      }),
    publish: <K extends WarehouseKind>(kind: K, entry: WarehouseEntry<WarehouseContents[K]>) =>
      send<WarehouseEntry<WarehouseContents[K]>>(
        `/admin/${kind}/${entry.id}/drafts/${entry.revision.id}/publish`,
        "POST",
        { expectedVersion: entry.revision.version, changeNote: "Publish reviewed catalog content" },
      ),
    discard: <K extends WarehouseKind>(kind: K, entry: WarehouseEntry<WarehouseContents[K]>) =>
      send<WarehouseEntry<WarehouseContents[K]>>(
        `/admin/${kind}/${entry.id}/drafts/${entry.revision.id}/discard`,
        "POST",
        { expectedVersion: entry.revision.version, changeNote: "Discard working copy" },
      ),
    spellRemovals: (id: string, rulesetId: string) =>
      request<SpellRemoval[]>(`/admin/spells/${id}/removals?${new URLSearchParams({ rulesetId })}`),
    recordSpellRemoval: (
      id: string,
      value: { revisionId: string; patchVariantId: string; sourceUrl: string; notes: string | null },
    ) => send<SpellRemoval>(`/admin/spells/${id}/removals`, "POST", value),
    metadata: (kind: "items" | "enchantments") =>
      request<WarehouseMetadata[]>(`/admin/${kind === "items" ? "item-categories" : "enchantment-branches"}`),
    reorderBranches: (entries: WarehouseMetadata[]) =>
      send<WarehouseMetadata[]>("/admin/enchantment-branches/order", "PUT", {
        entries: entries.map((entry) => ({ code: entry.code, expectedVersion: entry.version })),
      }),
    reorderEnchantments: (
      rulesetId: string,
      branchCode: string,
      tier: number,
      entries: WarehouseEntry<EnchantmentContent>[],
    ) =>
      send<WarehouseEntry<EnchantmentContent>[]>("/admin/enchantments/order", "PUT", {
        rulesetId,
        branchCode,
        tier,
        entries: entries.map((entry) => ({
          id: entry.id,
          revisionId: entry.revision.id,
          expectedVersion: entry.revision.version,
        })),
      }),
    saveMetadata: (kind: "items" | "enchantments", value: WarehouseMetadata) =>
      send<WarehouseMetadata>(
        `/admin/${kind === "items" ? "item-categories" : "enchantment-branches"}/${encodeURIComponent(value.code)}`,
        "PUT",
        {
          expectedVersion: value.version,
          displayOrder: value.displayOrder,
          iconAssetId: value.iconAssetId,
          backgroundAssetId: value.backgroundAssetId,
          color: value.color,
          translations: value.translations,
        },
      ),
  }
}
export const warehouseApi = createWarehouseApi()
export function useWarehouseCatalog<K extends WarehouseKind>(kind: K, rulesetId: string, locale: string) {
  return useQuery({
    queryKey: warehouseKeys.catalog(kind, rulesetId, locale),
    queryFn: ({ signal }) => warehouseApi.list(kind, rulesetId, locale, signal),
    enabled: !!rulesetId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  })
}
export function useWarehouseMetadata(kind: "items" | "enchantments") {
  return useQuery({
    queryKey: warehouseKeys.metadata(kind),
    queryFn: () => warehouseApi.metadata(kind),
    staleTime: 60000,
  })
}
