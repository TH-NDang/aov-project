import { ArrowDown, ArrowUp, RefreshCw, SlidersHorizontal, Sparkles, Wrench, X, type LucideIcon } from "lucide-react"
import { patchChangeLabel, patchChangeTone } from "../lib/change-kinds"
import { changeShortWord } from "../lib/change-short-word"
import { useWikiContext } from "../context/wiki-context"
import "./change-tag.css"

/**
 * What a version did to a hero, an item or another entry: its mark, then one short word players use (Buff, Nerf, Tweak,
 * Fix…), bold and slanted in the colour of the change.
 */
export function ChangeTag({ kind }: { kind?: string | null }) {
  if (!kind) return null
  const tone = patchChangeTone(kind)
  return (
    <span className="wiki-change-tag" data-tone={tone}>
      <ChangeKindMark kind={kind} size={16} />
      <span className="wiki-change-tag-word">{changeShortWord(kind, tone)}</span>
    </span>
  )
}

/** How many entries a version changed in each way, as tags with counts: "Buff 2 · Nerf 1". */
export function ChangeTally({ kinds }: { kinds: ReadonlyMap<string, number> }) {
  const { locale } = useWikiContext()
  if (!kinds.size) return null
  const label = [...kinds].map(([kind, count]) => `${count} ${patchChangeLabel(kind, locale)}`).join(", ")
  return (
    <span className="wiki-change-tally" aria-label={label}>
      {[...kinds].map(([kind, count]) => (
        <span key={kind} aria-hidden="true">
          <ChangeTag kind={kind} />
          <span className="wiki-change-tally-count">{count}</span>
        </span>
      ))}
    </span>
  )
}

/** The Lucide icon of each kind of change. */
const ICONS: Record<string, LucideIcon> = {
  up: ArrowUp,
  down: ArrowDown,
  rework: RefreshCw,
  new: Sparkles,
  adjust: SlidersHorizontal,
  fix: Wrench,
  removed: X,
}
const ICON_OF: Record<string, string> = { FIX: "fix", BUG_FIX: "fix", REMOVED: "removed" }

/**
 * The mark of a change kind: a Lucide icon in a soft disc of the kind's colour — an arrow up for a buff (red), down for a
 * nerf (green), a turn for a rework, sparkles for something new, sliders for a tweak, a wrench for a fix. The icon is
 * drawn at a whole number of pixels so its lines stay sharp.
 */
export function ChangeKindMark({ kind, size = 20 }: { kind?: string | null; size?: number }) {
  if (!kind) return null
  const tone = patchChangeTone(kind)
  const Icon = ICONS[ICON_OF[kind] ?? tone] ?? SlidersHorizontal
  return (
    <span
      className="wiki-change-mark"
      data-tone={tone}
      data-kind={ICON_OF[kind]}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.68)} strokeWidth={2.75} absoluteStrokeWidth={false} />
    </span>
  )
}
