import { useState } from "react"
import { WikiIcon } from "./wiki-icon"
import { WikiImage } from "./wiki-image"
import type { HeroDetail, PublicSkill } from "../lib/hero-api"

/**
 * The picture of a skill from the hero detail: its state picture, its own icon, or the hero's skill library picture
 * that the API already puts in `skillMedia` for skills without an icon (ADR-030). Nothing is read from `resources/`.
 */
export function SkillIcon({
  hero,
  skill,
  stateAssetId,
  className,
}: {
  hero: HeroDetail
  skill: PublicSkill
  locale: string
  /** Shows the skill in one of its states instead of its own picture. */
  stateAssetId?: string | null
  /** Sizes the picture; the icon shown in place of a missing one keeps its own size. */
  className?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const url =
    (stateAssetId && hero.skillStateMedia?.[stateAssetId]?.currentVersion?.url) ||
    hero.skillMedia?.[skill.skillKey]?.currentVersion?.url
  if (!url || url === failed) return <WikiIcon name={skill.kind === "PASSIVE" ? "spark" : "items"} size={20} />
  return <WikiImage className={className} src={url} alt="" width={36} height={36} onError={() => setFailed(url)} />
}
