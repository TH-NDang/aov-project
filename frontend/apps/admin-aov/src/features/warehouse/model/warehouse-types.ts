import type { WarehouseContent, WarehouseMetadata as ViewMetadata } from "@aov/ui/lib/warehouse-content"

export interface WarehouseRevision {
  id: string
  ownerId: string
  code: string
  rulesetId: string
  revisionNo: number
  state: "DRAFT" | "PUBLISHED" | "DISCARDED"
  version: number
  publicationSequence: number | null
  publishedAt: string | null
  cause: "DATA_BASELINE" | "GAME_PATCH" | "CONTENT_CORRECTION" | "TRANSLATION_UPDATE"
  effectiveFromPatchVariantId: string | null
  sourceRevisionId: string | null
  createdAt: string
  updatedAt: string
  archived?: boolean
}
export interface WarehouseEntry<C extends WarehouseContent = WarehouseContent> {
  id: string
  code: string
  revision: WarehouseRevision
  content: C
  issues?: string[]
  changeKinds?: import("../components/catalog-changes").CatalogBadgeKind[]
  missingFields?: string[]
}

export type WarehouseBaselineMode = "initial" | "inherited"

export function warehouseBaselineMode(
  revision: Pick<WarehouseRevision, "cause" | "effectiveFromPatchVariantId" | "sourceRevisionId">,
  missingFields: string[] = [],
): WarehouseBaselineMode | undefined {
  if (revision.cause === "DATA_BASELINE" && !revision.sourceRevisionId) return "initial"
  if (
    !revision.effectiveFromPatchVariantId &&
    revision.sourceRevisionId &&
    ["CONTENT_CORRECTION", "TRANSLATION_UPDATE"].includes(revision.cause) &&
    !missingFields.includes("effectiveFromPatchVariantId")
  )
    return "inherited"
  return undefined
}

export interface WarehouseMetadata extends ViewMetadata {
  version: number
}

export interface SpellRemoval {
  id: string
  revisionId: string
  rulesetId: string
  patchVariantId: string
  sourceUrl: string
  notes: string | null
  recordedAt: string
}
