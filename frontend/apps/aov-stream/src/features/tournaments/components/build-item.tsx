import type { Catalog } from "@aov/community-contracts"
import type { BuiltItem } from "../../../lib/build-view"
import { ReferenceArt } from "./reference-art"
import "./build-item.css"

/** The parts drawn on an item: one for each of its lower corners. The details name every part. */
const CORNERS = 2

/**
 * An item a player had, with the items it grew from small on its lower corners; one that is `gone`, given up for
 * another, shows itself alone.
 */
export function BuildItem({ catalog, built, gone = false }: { catalog: Catalog; built: BuiltItem; gone?: boolean }) {
  return (
    <span className="tn-build-item" data-gone={gone || undefined}>
      <ReferenceArt catalog={catalog} kind="items" selection={built.item} />
      {!gone &&
        built.from.slice(0, CORNERS).map((part, index) => (
          <span key={index} className="tn-build-part">
            <ReferenceArt catalog={catalog} kind="items" selection={part.item} />
          </span>
        ))}
    </span>
  )
}
