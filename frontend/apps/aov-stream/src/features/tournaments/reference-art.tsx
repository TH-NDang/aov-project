import type { Catalog, Selection } from "@aov/community-contracts"
import { StreamImage } from "../../components/stream-image"
import { findReference, referenceName, type CatalogKind } from "./tournament-model"

export function ReferenceArt({
  catalog,
  kind,
  selection,
  className = "",
}: {
  catalog: Catalog
  kind: CatalogKind
  selection?: Selection | null
  className?: string
}) {
  const reference = findReference(catalog, kind, selection)
  const name = referenceName(catalog, kind, selection)
  return (
    <span
      className={`reference-art ${className}`}
      title={`${name}${selection && !selection.id ? " · Chưa liên kết WiKi" : ""}`}
    >
      <StreamImage src={reference?.iconUrl} name={name} />
    </span>
  )
}
