import type { Catalog, Selection } from "@aov/community-contracts"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  findReference,
  nameInitials,
  referenceName,
  UNKNOWN_REFERENCE,
  type CatalogKind,
} from "../../../lib/tournament-model"
import { EntryPeek } from "./entry-peek"
import "./reference-art.css"

/**
 * The picture of a hero, an item or another catalogue entry. An entry without a picture shows two letters of its name
 * on a quiet tile, so a row of picks keeps its shape. An entry the Wiki knows shows its card when pointed at, with the
 * way to its page there; `peek` false keeps the picture still where a card would only be in the way.
 */
export function ReferenceArt({
  catalog,
  kind,
  selection,
  className = "",
  peek = true,
}: {
  catalog: Catalog
  kind: CatalogKind
  selection?: Selection | null
  className?: string
  peek?: boolean
}) {
  const { text } = useStreamLocale()
  const reference = findReference(catalog, kind, selection)
  const name = referenceName(catalog, kind, selection, text(...UNKNOWN_REFERENCE))
  const card = peek && !!reference
  const art = (
    <span className={`reference-art ${className}`} title={card ? undefined : name}>
      {reference?.iconUrl ? (
        <StreamImage src={reference.iconUrl} name={name} />
      ) : (
        <span className="reference-art-initials" role="img" aria-label={name}>
          {nameInitials(name)}
        </span>
      )}
    </span>
  )
  return card ? (
    <EntryPeek kind={kind} reference={reference}>
      {art}
    </EntryPeek>
  ) : (
    art
  )
}
