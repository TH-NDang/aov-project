import { Info, Swords } from "lucide-react"
import { HeroAsset } from "./hero-content"
import { skillImageMatch, useHeroSkillImages, type SkillImage } from "./skill-artwork"
import type { Skill } from "./types"

interface ComparisonSkillIconProps {
  before: Skill | null
  after: Skill | null
  /** The hero whose skill image library fills in a skill that neither version has an icon for. */
  heroId?: string
}

const LIBRARY_LABEL = "Ảnh thư viện kỹ năng, không phải ảnh của hai phiên bản đang so sánh"

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null
const records = (value: unknown): RecordValue[] =>
  Array.isArray(value) ? value.map(record).filter((item): item is RecordValue => item !== null) : []

/** The capture review found that the file name does not show this skill, so its slot cannot pick a picture. */
const mislabeled = (skill: Skill) =>
  skill.effects.some(
    (effect) =>
      effect.effectType === "SOURCE_SNAPSHOT" &&
      [...records(effect.metadata.heroReviewFlags), ...records(effect.metadata.reviewFlags)].some(
        (flag) => flag.type === "source_filename_display_mismatch",
      ),
  )

/**
 * The library picture of a skill that neither version has an icon for, by the rule the skills view uses. It is a labelled
 * reference, never evidence of a historical icon, so two different skill keys or a mislabeled capture give none.
 */
export function comparisonLibraryImage(
  before: Skill | null,
  after: Skill | null,
  images: readonly SkillImage[],
): SkillImage | undefined {
  const skills = [before, after].filter((skill): skill is Skill => skill !== null)
  if (!skills.length || new Set(skills.map((skill) => skill.skillKey)).size !== 1 || skills.some(mislabeled))
    return undefined
  return skillImageMatch(skills.at(-1)!, images)
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
      title="Chưa có ảnh kỹ năng phù hợp trong hai phiên bản hoặc thư viện ảnh kỹ năng"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/50 text-muted-foreground ${compact ? "size-10" : "size-12"}`}
    >
      <Swords aria-hidden="true" className="absolute -right-1 -bottom-1 size-8 opacity-15" />
      <span className="relative text-sm font-semibold">{slot === 0 ? "NT" : slot !== null ? `S${slot}` : "?"}</span>
    </div>
  )
}

export function ComparisonSkillIcon({ before, after, heroId }: ComparisonSkillIconProps) {
  const beforeId = before?.iconAssetId?.trim() || null
  const afterId = after?.iconAssetId?.trim() || null
  const boundId = afterId ?? beforeId
  // The library is only asked for when a skill is shown and neither version has an icon of its own.
  const library = useHeroSkillImages(boundId || (!before && !after) ? undefined : heroId)
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

  const image = comparisonLibraryImage(before, after, library.data ?? [])
  if (!image) return <MissingSkillIcon skill={after ?? before} />
  return (
    <div className="relative size-12 shrink-0" title={LIBRARY_LABEL}>
      <BoundSkillIcon id={image.assetId} alt={`${LIBRARY_LABEL} · ${skillName(after ?? before)}`} />
      <span className="pointer-events-none absolute -right-1 -bottom-1 rounded-full border bg-background p-0.5 text-muted-foreground">
        <Info aria-hidden="true" className="size-3" />
        <span className="sr-only">{LIBRARY_LABEL}</span>
      </span>
    </div>
  )
}
