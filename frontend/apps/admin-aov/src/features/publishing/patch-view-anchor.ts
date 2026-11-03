import type { Variant } from "./publication-overview"
import type { Revision } from "./types"

/** Only published, dated snapshots can be selected as explicit evidence. */
export function patchViewAnchors(revisions: Revision[], heroId: string, rulesetId: string, variants: Variant[]) {
  const ordinals = new Map(
    variants.filter((item) => item.rulesetId === rulesetId).map((item) => [item.id, item.rulesetOrdinal]),
  )
  return revisions
    .filter(
      (item) =>
        item.heroId === heroId &&
        item.rulesetId === rulesetId &&
        item.state === "PUBLISHED" &&
        item.effectiveFromPatchVariantId !== null &&
        ordinals.has(item.effectiveFromPatchVariantId),
    )
    .sort(
      (a, b) =>
        ordinals.get(b.effectiveFromPatchVariantId!)! - ordinals.get(a.effectiveFromPatchVariantId!)! ||
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
        b.revisionNo - a.revisionNo,
    )
}

export function selectedPatchAnchor(anchors: Revision[], requested: string | null) {
  if (requested === "auto") return null
  return anchors.find((item) => item.id === requested) ?? anchors.find((item) => item.cause === "DATA_BASELINE") ?? null
}

export function patchViewRequest(heroId: string, variantId: string, anchorRevisionId: string | null) {
  const query = new URLSearchParams({ patchVariantId: variantId })
  if (anchorRevisionId) query.set("anchorRevisionId", anchorRevisionId)
  return {
    queryKey: ["hero-patch-view", heroId, variantId, anchorRevisionId],
    path: `/admin/heroes/${encodeURIComponent(heroId)}/patch-view?${query}`,
  }
}
