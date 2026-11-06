import { useState } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { wikiText } from "../../context/wiki-context"
import type { HeroDetail, PublicSkill } from "./hero-api"
import { skillIllustration } from "./skill-illustration"

export function SkillIcon({ hero, skill, locale }: { hero: HeroDetail; skill: PublicSkill; locale: string }) {
  const [failed, setFailed] = useState<string[]>([])
  const bound = hero.skillMedia?.[skill.skillKey]?.currentVersion?.url
  const reference = skillIllustration(hero.code, skill)
  const url = [bound, reference].find((value): value is string => !!value && !failed.includes(value))
  if (!url) return <WikiIcon name={skill.kind === "PASSIVE" ? "spark" : "items"} size={20} />
  return (
    <WikiImage
      src={url}
      alt=""
      width={36}
      height={36}
      title={
        url === bound
          ? undefined
          : wikiText(locale, "Ảnh tham khảo · Garena / Liên Quân Mobile", "Reference artwork · Garena / Arena of Valor")
      }
      onError={() => setFailed((previous) => [...previous, url])}
    />
  )
}
