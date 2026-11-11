import { ArrowRight, ExternalLink, FileText, GitCompareArrows } from "lucide-react"
import { ChangeKindBadge } from "./hero-change-badges"
import { cn } from "@aov/ui/lib/utils"
import { SOURCE_LABELS, UNIT_LABELS, skillFieldLabel, statLabel } from "./patch-change-model"
import { formatPatchValue } from "./patch-value"
import { SkillChangeList } from "./skill-change-list"
import { compareSkillRanks } from "./skill-rank-values"
import { SkillRankComparison } from "./skill-rank-table"
import { ROLES, type ChangeSource, type Content, type Role } from "./types"

export interface RecordedChange {
  id: string
  type: string
  changeKind: string
  [key: string]: unknown
}
export interface RecordedChangeSet {
  id: string
  heroId: string
  heroCode: string
  patchVariantId?: string
  overallKind?: string | null
  assessmentVersion?: number
  fromHeroRevisionId: string | null
  toHeroRevisionId: string | null
  sourceKind?: ChangeSource
  sourceUrl?: string | null
  /** The hero joined the game in this patch (ADR-016). */
  introducesHero?: boolean
  summary?: string
  actualLocale?: string
  changes: RecordedChange[]
}

export function KindBadge({ kind, className }: { kind: string; className?: string }) {
  return <ChangeKindBadge kind={kind} className={className} />
}

export function SourceBadge({ change }: { change: Pick<RecordedChangeSet, "sourceKind" | "sourceUrl"> }) {
  const notes = change.sourceKind === "PATCH_NOTES"
  const Icon = notes ? FileText : GitCompareArrows
  const label = SOURCE_LABELS[change.sourceKind ?? "SNAPSHOT"]
  if (notes && change.sourceUrl)
    return (
      <a
        href={change.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        title="Mở ghi chú cập nhật"
      >
        <Icon className="size-3.5" />
        {label}
        <ExternalLink className="size-3" />
      </a>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" />
      {label}
    </span>
  )
}

const text = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : String(value))

/** Keep the before/after and assessment of each field inside its skill. */
export function ChangeLines({
  changes,
  content,
  heroId,
  locale,
  className,
}: {
  changes: RecordedChange[]
  content?: Content | null
  heroId?: string
  locale: string
  className?: string
}) {
  return (
    <SkillChangeList
      entries={changes}
      skillKeyOf={(change) =>
        change.type === "HERO_SKILL_CHANGE" && typeof change.skillKey === "string" ? change.skillKey : undefined
      }
      skills={content?.SKILLS?.skills}
      heroId={heroId}
      locale={locale}
      className={className}
      renderRow={(change, skill) => {
        let subject = ""
        let before: unknown
        let after: unknown
        let detail: string | null = null
        switch (change.type) {
          case "HERO_STAT_CHANGE": {
            const unit = UNIT_LABELS[String(change.unitCode)] ?? ""
            subject = statLabel(String(change.statKey))
            before = change.oldValue === null ? null : `${change.oldValue}${unit}`
            after = change.newValue === null ? null : `${change.newValue}${unit}`
            break
          }
          case "HERO_SKILL_CHANGE": {
            subject = skillFieldLabel(String(change.fieldKey))
            before = typeof change.oldValue === "string" ? formatPatchValue(change.oldValue) : change.oldValue
            after = typeof change.newValue === "string" ? formatPatchValue(change.newValue) : change.newValue
            break
          }
          case "HERO_ROLE_CHANGE":
            subject = `${change.added ? "Thêm" : "Bỏ"} vai trò ${ROLES[change.roleCode as Role] ?? text(change.roleCode)}`
            break
          case "HERO_VISUAL_CHANGE":
            subject = `Ảnh ${text(change.mediaRole).toLowerCase()}`
            detail = "Đổi ảnh tướng"
            break
          case "HERO_MECHANIC_CHANGE":
            subject = `Cơ chế: ${skillFieldLabel(text(change.mechanicKey))}`
            detail = text(change.description)
            break
          default:
            subject = "Khác"
            detail = text(change.description)
        }
        const long = String(before ?? "").length > 40 || String(after ?? "").length > 40
        const ranks =
          change.type === "HERO_SKILL_CHANGE" ? compareSkillRanks(change.oldValue, change.newValue, skill, skill) : null
        return (
          <li key={change.id} className={cn("py-2.5 text-sm", change.type !== "HERO_SKILL_CHANGE" && "border-b px-3")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{subject}</span>
                <KindBadge kind={change.changeKind} />
              </div>
              {detail && <span className="block whitespace-pre-wrap text-muted-foreground">{detail}</span>}
              {ranks ? (
                <div className="mt-2">
                  <SkillRankComparison data={ranks} label={skillFieldLabel(String(change.fieldKey))} locale={locale} />
                </div>
              ) : (
                (before !== undefined || after !== undefined) &&
                (long ? (
                  <span className="type-body mt-1 grid gap-1.5">
                    <span className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-2 rounded-md bg-muted/30 px-2 py-1.5">
                      <span className="type-meta">Trước</span>
                      <span className="whitespace-pre-wrap break-words">{text(before)}</span>
                    </span>
                    <span className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-2 rounded-md bg-muted/50 px-2 py-1.5">
                      <span className="type-meta">Sau</span>
                      <span className="whitespace-pre-wrap break-words">{text(after)}</span>
                    </span>
                  </span>
                ) : (
                  <span className="mt-1 inline-flex flex-wrap items-center gap-1.5 tabular-nums">
                    <span className="text-muted-foreground">{text(before)}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{text(after)}</span>
                  </span>
                ))
              )}
            </div>
          </li>
        )
      }}
    />
  )
}
