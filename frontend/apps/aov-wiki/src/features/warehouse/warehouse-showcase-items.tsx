import { useMemo, type CSSProperties } from "react"
import { itemCategoryTone } from "@aov/ui/components/item-category-icons"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  warehouseImage,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
} from "../../lib/warehouse-types"
import { useShowcaseTurn } from "./use-showcase-turn"
import type { WarehouseItem } from "./use-item-catalog"
import { itemMatchesCategory } from "./warehouse-item-layout"
import { WarehouseShowcase, type ShowcaseIntro } from "./warehouse-showcase"
import "./warehouse-showcase-items.css"

/** A hero's six slots; at most five hold standout items, so the display never reads as a full build. */
const SLOTS = 6
const MOST = 5
const LEAST = 3

interface Piece {
  url: string
  name: string
}

interface SixSlots {
  code: string
  name: string
  tone: string
  pieces: Piece[]
}

/**
 * The items' head: a hero's six slots, holding the standout items of one shop group, one for each role the group
 * covers, and the rest left empty for the reader to fill. Every few seconds the next group in the shop fills the slots,
 * one by one. The items are picked from the catalog, not a recommended build, and the caption says so.
 */
export function ItemShowcase({
  intro,
  entries,
  groups,
}: {
  intro: ShowcaseIntro
  entries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
}) {
  const { locale } = useWikiContext()
  const sets = useMemo(() => sixSlotSets(entries, groups, locale), [entries, groups, locale])
  const { scene: set, leaving } = useShowcaseTurn(sets, picturesOf)
  return (
    <WarehouseShowcase
      {...intro}
      scene={set && <SixSlotScene set={set} leaving={leaving} wide={intro.wide} />}
      caption={
        set && (
          // The caption changes with the scene every few seconds, so it is not read out each time.
          <p
            className="wiki-items-scene-caption"
            data-leaving={leaving || undefined}
            style={{ "--scene-tone": set.tone } as CSSProperties}
            aria-hidden="true"
          >
            {wikiText(locale, `Món tiêu biểu · ${set.name}`, `Standout items · ${set.name}`)}
          </p>
        )
      }
    />
  )
}

function picturesOf(set: SixSlots) {
  return set.pieces.map((piece) => piece.url)
}

function SixSlotScene({ set, leaving, wide }: { set: SixSlots; leaving: boolean; wide: boolean }) {
  return (
    <div
      key={set.code}
      className="wiki-items-scene"
      data-leaving={leaving || undefined}
      data-wide={wide || undefined}
      style={{ "--scene-tone": set.tone } as CSSProperties}
    >
      <div className="wiki-items-scene-panel">
        <div className="wiki-items-scene-grid">
          {Array.from({ length: SLOTS }, (_, index) => {
            const piece = set.pieces[index]
            return (
              <span
                key={piece ? `${index}-${piece.url}` : index}
                className="wiki-items-scene-slot"
                style={{ "--slot-order": index } as CSSProperties}
                title={piece?.name}
              >
                {piece && <img src={piece.url} alt="" decoding="async" />}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * The standout items of every shop group: from the group's highest tier, the dearest item of each role, a role being
 * the first tag of an item's summary, up to five. A group with fewer than three roles is left out. Groups keep the
 * shop's order.
 */
function sixSlotSets(entries: PublishedWarehouseRecord[], groups: WarehouseGroup[], locale: string): SixSlots[] {
  const items = entries.filter((entry): entry is WarehouseItem => entry.kind === "items" && !!warehouseImage(entry))
  return groups.flatMap((group) => {
    const members = items.filter((item) => itemMatchesCategory(item, group.code))
    const top = Math.max(0, ...members.map((item) => item.content.tier ?? 0))
    const roles = new Set<string>()
    const chosen = members
      .filter((item) => (item.content.tier ?? 0) === top)
      .sort((a, b) => (b.content.price ?? 0) - (a.content.price ?? 0))
      .filter((item) => {
        const role = (warehouseText(item.content.translations, locale)?.summary ?? item.code)
          .split(/[,;]/)[0]
          .trim()
          .toLocaleLowerCase(locale)
        if (roles.has(role)) return false
        roles.add(role)
        return true
      })
      .slice(0, MOST)
    if (chosen.length < LEAST) return []
    return [
      {
        code: group.code,
        name: warehouseText(group.translations, locale)?.name || group.code,
        tone: itemCategoryTone(group.code) ?? "var(--aov-accent)",
        pieces: chosen.map((item) => ({
          url: warehouseImage(item)!,
          name: warehouseText(item.content.translations, locale)?.name || item.code,
        })),
      },
    ]
  })
}
