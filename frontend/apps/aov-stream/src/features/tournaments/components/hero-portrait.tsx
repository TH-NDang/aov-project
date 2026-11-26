import type { HeroCount } from "@aov/community-contracts"
import { StreamImage } from "../../../components/stream-image"
import { nameInitials } from "../../../lib/tournament-model"
import "./hero-portrait.css"

/**
 * A hero's picture beside its name, which says who it is; two letters of the name where there is no picture. A `banned`
 * hero loses its colours and wears the "no" sign.
 */
export function HeroPortrait({
  hero,
  banned = false,
}: {
  hero: Pick<HeroCount, "name" | "iconUrl">
  banned?: boolean
}) {
  return (
    <span className="tn-portrait" data-banned={banned || undefined} aria-hidden="true">
      {hero.iconUrl ? <StreamImage src={hero.iconUrl} name={hero.name} /> : <b>{nameInitials(hero.name)}</b>}
    </span>
  )
}
