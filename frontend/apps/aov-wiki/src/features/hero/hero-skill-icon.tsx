import { useState } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import type { HeroDetail, PublicSkill } from "./hero-api"

/**
 * The picture of a skill from the hero detail: its state picture, its own icon, or the hero's skill library picture
 * that the API already puts in `skillMedia` for skills without an icon (ADR-030). Nothing is read from `resources/`.
 */
export function SkillIcon({
  hero,
  skill,
  stateAssetId,
}: {
  hero: HeroDetail
  skill: PublicSkill
  locale: string
  /** Shows the skill in one of its states instead of its own picture. */
  stateAssetId?: string | null
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const url =
    (stateAssetId && hero.skillStateMedia?.[stateAssetId]?.currentVersion?.url) ||
    hero.skillMedia?.[skill.skillKey]?.currentVersion?.url
  if (!url || url === failed) return <WikiIcon name={skill.kind === "PASSIVE" ? "spark" : "items"} size={20} />
  return <WikiImage src={url} alt="" width={36} height={36} onError={() => setFailed(url)} />
}
