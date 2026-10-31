import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Info, Swords } from "lucide-react"
import { ImagePreview } from "@/components/image-preview"
import { mediaUrl, RESOURCES_BASE } from "@/lib/media"
import { HeroAsset } from "./hero-content"
import type { Skill } from "./types"

interface ComparisonSkillIconProps {
  before: Skill | null
  after: Skill | null
  referenceCodes?: readonly string[]
}

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null
const records = (value: unknown): RecordValue[] =>
  Array.isArray(value) ? value.map(record).filter((item): item is RecordValue => item !== null) : []

function referenceIdentity({ before, after, referenceCodes = [] }: ComparisonSkillIconProps) {
  const codes = [...new Set(referenceCodes)]
  if (codes.length !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(codes[0]) || codes[0].length > 80) return null
  const skills = [before, after].filter((skill): skill is Skill => skill !== null)
  const keys = [...new Set(skills.map((skill) => skill.skillKey))]
  const match = keys.length === 1 ? /^skill-(\d+)-(\d+)$/.exec(keys[0]) : null
  if (!match) return null
  for (const skill of skills) {
    for (const effect of skill.effects.filter((item) => item.effectType === "SOURCE_SNAPSHOT")) {
      const source = effect.metadata
      if (typeof source.sourceHeroCode === "string" && source.sourceHeroCode !== codes[0]) return null
      if (
        [...records(source.heroReviewFlags), ...records(source.reviewFlags)].some(
          (flag) => flag.type === "source_filename_display_mismatch",
        )
      )
        return null
    }
  }
  return { code: codes[0], slot: Number(match[1]), variant: Number(match[2]) }
}

/** Current resource artwork is a labelled reference, never evidence of a historical icon. */
export function resolveComparisonReferenceIcon(props: ComparisonSkillIconProps, heroes: unknown): string | null {
  const identity = referenceIdentity(props)
  if (!identity) return null
  const matches = records(heroes).filter((hero) => hero.id === identity.code)
  if (matches.length !== 1) return null
  const skills = records(matches[0].skills).filter((skill) => skill.slot === identity.slot)
  if (skills.length !== 1) return null
  const variants = records(skills[0].variants).filter((variant) => variant.index === identity.variant)
  const path = variants.length === 1 ? variants[0].icon : null
  if (
    typeof path !== "string" ||
    !/^assets\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(path) ||
    path.split("/").includes("..")
  )
    return null
  return mediaUrl(path) ?? null
}

function skillName(skill: Skill | null) {
  return skill?.translations.find((translation) => translation.locale === "vi-VN")?.name || skill?.skillKey || "Kỹ năng"
}

function BoundSkillIcon({ id, alt, compact = false }: { id: string; alt: string; compact?: boolean }) {
  const sizeClass = compact ? "size-10" : "size-12"
  return (
    <div className={`shrink-0 rounded-full [&>div]:rounded-full [&>div>button>span]:rounded-full ${sizeClass}`}>
      <HeroAsset id={id} alt={alt} className={`${sizeClass} rounded-full`} preview />
    </div>
  )
}

function MissingSkillIcon({ skill, compact = false }: { skill: Skill | null; compact?: boolean }) {
  const match = /^skill-(\d+)-(\d+)$/.exec(skill?.skillKey ?? "")
  const slot = match ? Number(match[1]) : null
  const label = slot === 0 ? "Nội tại" : slot !== null ? `Chiêu ${slot}` : "Kỹ năng"
  return (
    <div
      role="img"
      aria-label={`${label} · Chưa có ảnh kỹ năng`}
      title="Chưa có ảnh kỹ năng phù hợp trong bản dữ liệu hoặc tài nguyên tham chiếu"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/50 text-muted-foreground ${compact ? "size-10" : "size-12"}`}
    >
      <Swords aria-hidden="true" className="absolute -right-1 -bottom-1 size-8 opacity-15" />
      <span className="relative text-sm font-semibold">{slot === 0 ? "NT" : slot !== null ? `S${slot}` : "?"}</span>
    </div>
  )
}

export function ComparisonSkillIcon(props: ComparisonSkillIconProps) {
  const { before, after } = props
  const beforeId = before?.iconAssetId?.trim() || null
  const afterId = after?.iconAssetId?.trim() || null
  const boundId = afterId ?? beforeId
  const eligible = !boundId && referenceIdentity(props) !== null
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const reference = useQuery({
    queryKey: ["comparison-reference-artwork", RESOURCES_BASE],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${RESOURCES_BASE}data/heroes.json`, { credentials: "omit", signal })
      if (!response.ok) throw new Error("Reference artwork is unavailable.")
      const data: unknown = await response.json()
      return record(data)?.heroes ?? []
    },
    enabled: eligible,
    staleTime: Infinity,
    retry: false,
  })
  if (before && after && beforeId !== afterId)
    return (
      <div className="flex shrink-0 gap-1.5" aria-label="Đổi ảnh kỹ năng">
        {(
          [
            [beforeId, before, "Trước"],
            [afterId, after, "Sau"],
          ] as const
        ).map(([id, skill, label]) => (
          <div key={label} className="space-y-1 text-center">
            {id ? (
              <BoundSkillIcon id={id} alt={`${label} · ${skillName(skill)}`} compact />
            ) : (
              <MissingSkillIcon skill={skill} compact />
            )}
            <span className="block text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    )
  if (boundId) return <BoundSkillIcon id={boundId} alt={skillName(after ?? before)} />

  const url = eligible ? resolveComparisonReferenceIcon(props, reference.data) : null
  const name = skillName(after ?? before)
  const referenceLabel = "Ảnh tham chiếu từ tài nguyên hiện tại"
  if (!url || failedUrl === url) return <MissingSkillIcon skill={after ?? before} />
  return (
    <div className="relative size-12 shrink-0" title={referenceLabel}>
      <ImagePreview
        src={url}
        alt={`${referenceLabel} · ${name}`}
        className="size-12 rounded-full [&>button>span]:rounded-full"
      >
        <img
          src={url}
          alt={`${referenceLabel} · ${name}`}
          loading="lazy"
          className="size-full rounded-full border object-cover"
          onError={() => setFailedUrl(url)}
        />
      </ImagePreview>
      <span className="pointer-events-none absolute -right-1 -bottom-1 rounded-full border bg-background p-0.5 text-muted-foreground">
        <Info aria-hidden="true" className="size-3" />
        <span className="sr-only">{referenceLabel}</span>
      </span>
    </div>
  )
}
