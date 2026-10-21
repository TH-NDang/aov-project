import { useQuery } from "@tanstack/react-query"
import { ArrowLeftRight, Sparkles } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { HeroAsset } from "./hero-asset"
import { skillSlot, skillVariant } from "./hero-skills"
import type { Skill } from "./types"

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
      {inventory && (
        <span className="pointer-events-none absolute -right-0.5 -bottom-0.5 rounded-full border bg-card p-0.5 text-muted-foreground">
          <Sparkles className="size-2.5" aria-hidden="true" />
          <span className="sr-only">Ảnh thư viện</span>
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
  const previews = [...skills.filter((skill) => skill !== active).slice(0, 2), active]
  return (
    <span aria-hidden="true" className={cn("relative inline-flex h-14 w-[4.5rem] shrink-0", className)}>
      {previews.map((skill, index) => (
        <span
          key={skill.skillKey}
          className="absolute rounded-full bg-card p-0.5 shadow-sm"
          style={{ left: index * 10, top: (previews.length - index - 1) * 5, zIndex: index + 1 }}
        >
          <SkillArtwork skill={skill} heroId={heroId} className="size-10" />
        </span>
      ))}
      {skills.length > 1 && (
        <span className="absolute right-0 bottom-0 z-10 flex items-center gap-0.5 rounded-full border bg-card px-1 py-0.5 text-[9px] font-medium text-muted-foreground">
          <ArrowLeftRight className="size-2.5" />
          {skills.length}
        </span>
      )}
    </span>
  )
}
