import type { HeroCount } from "@aov/community-contracts"
import { StreamImage } from "../../../components/stream-image"
import { nameInitials } from "../../../lib/tournament-model"
import "./hero-portrait.css"

/** A hero's picture beside its name, which says who it is; two letters of the name where there is no picture. */
export function HeroPortrait({ hero }: { hero: Pick<HeroCount, "name" | "iconUrl"> }) {
  return (
    <span className="tn-portrait" aria-hidden="true">
      {hero.iconUrl ? <StreamImage src={hero.iconUrl} name="" /> : <b>{nameInitials(hero.name)}</b>}
    </span>
  )
}
