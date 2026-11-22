import { patchChangeTone } from "../../../components/patch-changes-row"
import { changeShortWord } from "../model/change-short-word"
import "./hero-change-tag.css"

/**
 * What a version did to the hero as the hero library tags it: one short word players use (Buff, Nerf, Tweak, Fix…), bold
 * and slanted in the colour of the change.
 */
export function HeroChangeTag({ kind }: { kind?: string | null }) {
  if (!kind) return null
  const tone = patchChangeTone(kind)
  return (
    <span className="wiki-hero-change-tag" data-tone={tone}>
      {changeShortWord(kind, tone)}
    </span>
  )
}
