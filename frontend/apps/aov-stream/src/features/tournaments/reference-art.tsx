import type { Catalog, Selection } from "@aov/community-contracts"
import { StreamImage } from "../../components/stream-image"
import { useStreamLocale } from "../../components/stream-locale"
import { findReference, referenceName, UNKNOWN_REFERENCE, type CatalogKind } from "./tournament-model"

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
  const { text } = useStreamLocale()
  const reference = findReference(catalog, kind, selection)
  const name = referenceName(catalog, kind, selection, text(...UNKNOWN_REFERENCE))
  return (
    <span
      className={`reference-art ${className}`}
      title={`${name}${selection && !selection.id ? text(" · Chưa liên kết WiKi", " · Not linked to the WiKi") : ""}`}
    >
      <StreamImage src={reference?.iconUrl} name={name} />
    </span>
  )
}
