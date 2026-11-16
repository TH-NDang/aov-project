import type { Catalog, Selection } from "@aov/community-contracts"
import { StreamImage } from "../../components/stream-image"
import { findReference, nameInitials, referenceName, type CatalogKind } from "./tournament-model"

/**
 * The picture of a hero, an item or another catalogue entry. An entry without a picture shows two letters of its name
 * on a quiet tile, so a row of picks keeps its shape.
 */
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
    <span className={`reference-art ${className}`} title={name}>
      {reference?.iconUrl ? (
        <StreamImage src={reference.iconUrl} name={name} />
      ) : (
        <span className="reference-art-initials" role="img" aria-label={name}>
          {nameInitials(name)}
        </span>
      )}
    </span>
  )
}
