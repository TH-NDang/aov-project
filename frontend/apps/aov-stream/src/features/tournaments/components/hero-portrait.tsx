import type { HeroCount } from "@aov/community-contracts"
import { BAN_FACE } from "@aov/ui/components/draft-marks"
import { StreamImage } from "../../../components/stream-image"
import { nameInitials } from "../../../lib/tournament-model"
import "./hero-portrait.css"

/**
 * A hero's picture beside its name, which says who it is; two letters of the name where there is no picture. A `banned`
 * hero wears the shared look of a ban: grey, under the "no" sign.
 */
export function HeroPortrait({
  hero,
  banned = false,
}: {
  hero: Pick<HeroCount, "name" | "iconUrl">
  banned?: boolean
}) {
  return (
    <span className={banned ? `tn-portrait ${BAN_FACE}` : "tn-portrait"} aria-hidden="true">
      {hero.iconUrl ? <StreamImage src={hero.iconUrl} name={hero.name} /> : <b>{nameInitials(hero.name)}</b>}
    </span>
  )
}
