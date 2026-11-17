import { useQuery } from "@tanstack/react-query"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { HeroAsset } from "../hero-asset"
import { skillSlot, skillVariant } from "../../model/skills/hero-skills"
import type { Skill } from "../../api/types"

export interface SkillImage {
  id: string
  heroId: string
  skillKey: string | null
  sourceSlot: number
  variantNo: number
  assetId: string
  sourceFilename: string
  label: string | null
  version: number
}

export function useHeroSkillImages(heroId?: string) {
  return useQuery({
    queryKey: ["hero-skill-images", heroId],
    queryFn: async ({ signal }) =>
      (await backendRequest<{ items: SkillImage[] }>(`/admin/heroes/${heroId}/skill-images`, { signal })).items,
    enabled: !!heroId,
    staleTime: 60000,
    retry: false,
  })
}

/** Require an unambiguous identity match; names and array positions are not identifiers. */
export function skillImageMatch(skill: Skill, images: readonly SkillImage[]) {
  const exact = images.filter((image) => image.skillKey === skill.skillKey)
  if (exact.length) return exact.length === 1 ? exact[0] : undefined
  const slot = skillSlot(skill)
  const variant = skillVariant(skill)
  if (slot === null || variant === null) return undefined
  const matches = images.filter((image) => image.sourceSlot === slot && image.variantNo === variant && !image.skillKey)
  return matches.length === 1 ? matches[0] : undefined
}

export function SkillArtwork({
  skill,
  heroId,
  className,
  preview = false,
}: {
  skill: Skill
  heroId?: string
  className?: string
  preview?: boolean
}) {
  const images = useHeroSkillImages(heroId)
  const inventory = skill.iconAssetId ? undefined : skillImageMatch(skill, images.data ?? [])
  const assetId = skill.iconAssetId || inventory?.assetId
  const slot = skillSlot(skill)
  const shortLabel = skill.kind === "PASSIVE" ? "NT" : slot !== null && slot > 0 ? `${slot}` : "—"
  return (
    <span
      className={cn("relative inline-flex size-12 shrink-0 rounded-full", className)}
      title={inventory ? "Ảnh thư viện kỹ năng · không phải ảnh xác nhận riêng của phiên bản này" : undefined}
    >
      {assetId ? (
        <HeroAsset
          id={assetId}
          alt={inventory ? "Ảnh thư viện kỹ năng" : "Ảnh kỹ năng của phiên bản"}
          className="size-full rounded-full border-0"
          frameAspectRatio={1}
          preview={preview}
        />
      ) : (
        <span
          role="img"
          aria-label={`${shortLabel === "NT" ? "Nội tại" : slot !== null ? `Chiêu ${slot}` : "Kỹ năng"} · chưa có ảnh`}
          className="flex size-full items-center justify-center rounded-full border bg-muted text-base font-semibold text-muted-foreground"
        >
          {shortLabel}
        </span>
      )}
    </span>
  )
}

export function SkillArtworkStack({
  skills,
  heroId,
  selectedSkillKey,
  className,
}: {
  skills: readonly Skill[]
  heroId?: string
  selectedSkillKey?: string
  className?: string
}) {
  const active = skills.find((skill) => skill.skillKey === selectedSkillKey) ?? skills[0]
  if (!active) return null
  // The chosen variant stands in front at the size of a single icon; the others peek out behind it to the right,
  // smaller and dimmer the further back they sit, so a slot with variants reads at a glance without a number.
  const behind = skills.filter((skill) => skill !== active).slice(0, 2)
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-10 shrink-0", className)}>
      {behind
        .map((skill, index) => ({ skill, depth: index + 1 }))
        .reverse()
        .map(({ skill, depth }) => (
          <span
            key={skill.skillKey}
            className="absolute inset-0 rounded-full bg-card ring-2 ring-card"
            style={{ transform: `translateX(${depth * 10}px) scale(${1 - depth * 0.1})`, opacity: 1 - depth * 0.3 }}
          >
            <SkillArtwork skill={skill} heroId={heroId} className="size-full" />
          </span>
        ))}
      <span className="absolute inset-0 rounded-full bg-card ring-2 ring-card">
        <SkillArtwork skill={active} heroId={heroId} className="size-full" />
      </span>
    </span>
  )
}
