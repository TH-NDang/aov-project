import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  warehouseImage,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
} from "../../lib/warehouse-types"
import type { WarehouseEnchantment } from "./use-item-catalog"
import { useMediaQuery } from "./warehouse-layout"
import { WarehouseShowcase, type ShowcaseIntro } from "./warehouse-showcase"
import "./warehouse-showcase-enchantments.css"

const TIER_NAMES = ["I", "II", "III"] as const
/** How long one set stays before the next branch takes the lead, and how long the old set takes to fade. */
const SET_STAYS_MS = 7000
const SET_LEAVES_MS = 360

/**
 * Where the pieces of the sample set stand, as shares of the scene, with their size in pixels: the primary branch
 * climbs from tier I to tier III, and the two secondary pieces sit apart below it.
 */
const PATH_COMPACT = [
  { x: 61, y: 70, size: 36 },
  { x: 72, y: 45, size: 44 },
  { x: 86, y: 22, size: 56 },
] as const
const SIDES_COMPACT = [
  { x: 93, y: 64, size: 32 },
  { x: 82, y: 80, size: 30 },
] as const

/** A wide banner stretches the climb across its scene and sets the secondary pieces further right. */
const PATH_WIDE = [
  { x: 22, y: 72, size: 40 },
  { x: 45, y: 52, size: 48 },
  { x: 69, y: 31, size: 60 },
] as const
const SIDES_WIDE = [
  { x: 84, y: 70, size: 36 },
  { x: 92, y: 40, size: 32 },
] as const

interface Piece {
  url: string
  color: string
}

type SampleSet = NonNullable<ReturnType<typeof sampleSet>>

/**
 * The enchantments' head: one set, drawn as the lines beside it read, and a caption naming the branch that leads it.
 * Three pieces of one branch climb from tier I to tier III along a line in that branch's colour; two pieces of two other
 * branches stand aside, each ringed in its own colour. Round frames, as the game draws enchantments.
 */
export function EnchantmentShowcase({
  intro,
  entries,
  groups,
}: {
  intro: ShowcaseIntro
  entries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
}) {
  const { locale } = useWikiContext()
  const { set, leaving } = useSampleSets(entries, groups)
  const lead = set && groups.find((group) => group.code === set.code)
  const name = lead && (warehouseText(lead.translations, locale)?.name || lead.code)
  return (
    <WarehouseShowcase
      {...intro}
      scene={set && <EnchantmentScene set={set} leaving={leaving} wide={intro.wide} />}
      caption={
        set &&
        name && (
          // The caption changes with the scene every few seconds, so it is not read out each time.
          <p
            className="wiki-enchantment-scene-caption"
            data-leaving={leaving || undefined}
            style={{ "--scene-tone": set.tone } as CSSProperties}
            aria-hidden="true"
          >
            {wikiText(locale, `Bộ mẫu · ${name} dẫn đầu`, `Sample set · ${name} leads`)}
          </p>
        )
      }
    />
  )
}

/**
 * One sample set per branch, and the one on show. Every few seconds the next branch leads: the set fades and the new
 * one is put together piece by piece, tier I first. A reader who asks for less motion keeps the first set, and a
 * hidden tab keeps the set it has.
 */
function useSampleSets(entries: PublishedWarehouseRecord[], groups: WarehouseGroup[]) {
  const sets = useMemo(() => groups.flatMap((_, index) => sampleSet(entries, groups, index) ?? []), [entries, groups])
  const still = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [turn, setTurn] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const rotates = !still && sets.length > 1

  useEffect(() => {
    if (!rotates) return
    let swap: number | undefined
    const timer = window.setInterval(() => {
      if (document.hidden) return
      setLeaving(true)
      swap = window.setTimeout(() => {
        setTurn((current) => current + 1)
        setLeaving(false)
      }, SET_LEAVES_MS)
    }, SET_STAYS_MS)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(swap)
    }
  }, [rotates])

  // The next set's pictures load while this one is on show, so it is whole when its turn comes.
  const next = rotates ? sets[(turn + 1) % sets.length] : undefined
  useEffect(() => {
    for (const piece of next ? [...next.path, ...next.sides] : []) new Image().src = piece.url
  }, [next])

  return { set: sets.length ? sets[turn % sets.length] : undefined, leaving }
}

function EnchantmentScene({ set, leaving, wide }: { set: SampleSet; leaving: boolean; wide: boolean }) {
  const PATH = wide ? PATH_WIDE : PATH_COMPACT
  const SIDES = wide ? SIDES_WIDE : SIDES_COMPACT
  const { path, sides, tone } = set

  return (
    <div
      key={set.code}
      className="wiki-enchantment-scene"
      data-leaving={leaving || undefined}
      style={{ "--scene-tone": tone } as CSSProperties}
    >
      <svg className="wiki-enchantment-scene-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={PATH.map(({ x, y }) => `${x},${y}`).join(" ")} />
        <line x1={SIDES[0].x} y1={SIDES[0].y} x2={SIDES[1].x} y2={SIDES[1].y} data-side="" />
      </svg>
      {path.map((piece, index) => (
        <ScenePiece
          key={index}
          piece={piece}
          place={PATH[index]}
          order={index}
          tier={TIER_NAMES[index]}
          top={index === 2}
        />
      ))}
      {sides.map((piece, index) => (
        <ScenePiece key={`side-${index}`} piece={piece} place={SIDES[index]} order={PATH.length + index} />
      ))}
    </div>
  )
}

function ScenePiece({
  piece,
  place,
  order,
  tier,
  top = false,
}: {
  piece: Piece
  place: { x: number; y: number; size: number }
  /** Its turn when the set is put together. */
  order: number
  tier?: string
  top?: boolean
}) {
  return (
    <span
      className="wiki-enchantment-scene-piece"
      data-top={top || undefined}
      style={
        {
          "--piece-x": `${place.x}%`,
          "--piece-y": `${place.y}%`,
          "--piece-size": `${place.size}px`,
          "--piece-tone": piece.color,
          "--piece-order": order,
        } as CSSProperties
      }
    >
      <img src={piece.url} alt="" decoding="async" />
      {tier && <span className="wiki-enchantment-scene-tier">{tier}</span>}
    </span>
  )
}

/**
 * A set the game allows, led by one branch: its first enchantment of each tier, and the first tier I enchantment of
 * the next two branches. Left out unless every piece has a picture.
 */
function sampleSet(entries: PublishedWarehouseRecord[], groups: WarehouseGroup[], lead: number) {
  const records = entries.filter((entry): entry is WarehouseEnchantment => entry.kind === "enchantments")
  const first = (branchCode: string, tier: number) => {
    const entry = records
      .filter(({ content }) => content.branchCode === branchCode && content.tier === tier)
      .sort((a, b) => (a.content.position ?? 99) - (b.content.position ?? 99))[0]
    return entry && warehouseImage(entry)
  }
  if (groups.length < 3) return null
  const primary = groups[lead]
  const others = [groups[(lead + 1) % groups.length], groups[(lead + 2) % groups.length]]
  const tone = enchantmentBranchColor(primary)
  const path = [1, 2, 3].map((tier) => first(primary.code, tier))
  const sides = others.map((branch) => ({ url: first(branch.code, 1), color: enchantmentBranchColor(branch) }))
  if (path.some((url) => !url) || sides.some((side) => !side.url)) return null
  return {
    code: primary.code,
    tone,
    path: path.map((url) => ({ url: url!, color: tone })),
    sides: sides.map((side) => ({ url: side.url!, color: side.color })),
  }
}
