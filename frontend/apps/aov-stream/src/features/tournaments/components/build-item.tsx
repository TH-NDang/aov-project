import type { Catalog } from "@aov/community-contracts"
import type { BuiltItem, Fate } from "../../../lib/build-view"
import { findReference } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./build-item.css"

/** A bolt for an item with an effect the player sets off, a shield for one bought for protection. */
const MARKS = {
  active: "M13.5 2 5 13.5h5.5L9.5 22 19 9.5h-5.5L13.5 2Z",
  protective: "M12 2.5 20 6v5.5c0 4.6-3.3 8.1-8 10-4.7-1.9-8-5.4-8-10V6l8-3.5Z",
}

function Mark({ kind }: { kind: keyof typeof MARKS }) {
  return (
    <span className="tn-build-mark" data-mark={kind}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={MARKS[kind]} />
      </svg>
    </span>
  )
}

/**
 * An item a player had, with a bolt where it has an effect to set off and a shield where it was bought for protection.
 * One that went into another or was sold steps back; a sold one is crossed out as well.
 */
export function BuildItem({ catalog, built, fate = "HELD" }: { catalog: Catalog; built: BuiltItem; fate?: Fate }) {
  const active = !!findReference(catalog, "items", built.item)?.active
  return (
    <span
      className="tn-build-item"
      data-gone={fate === "HELD" ? undefined : fate.toLowerCase()}
      data-protective={built.protective || undefined}
    >
      <ReferenceArt catalog={catalog} kind="items" selection={built.item} />
      {active && <Mark kind="active" />}
      {built.protective && <Mark kind="protective" />}
    </span>
  )
}
