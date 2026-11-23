import { changeKindIcon, changeKindIcons } from "@aov/ui/components/change-kind-icons"
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

/**
 * The mark of a change kind: the shared change icon (`changeKindIcons`, also drawn by Admin) in a soft disc of the
 * kind's colour — a rising line for a buff (red), a falling one for a nerf (green), a hammer for a rework, a falling
 * star for something new. A kind without a mark of its own reads as an adjustment. The icon is drawn at a whole number
 * of pixels so its lines stay sharp.
 */
export function ChangeKindMark({ kind, size = 20 }: { kind?: string | null; size?: number }) {
  if (!kind) return null
  const tone = patchChangeTone(kind)
  const Icon = changeKindIcon(kind) ?? changeKindIcons.ADJUSTMENT
  return (
    <span
      className="wiki-change-mark"
      data-tone={tone}
      data-kind={kind === "REMOVED" ? "removed" : undefined}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.68)} strokeWidth={2.75} />
    </span>
  )
}
