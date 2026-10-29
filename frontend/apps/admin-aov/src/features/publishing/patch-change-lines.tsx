import { ArrowRight, ExternalLink, FileText, GitCompareArrows } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { cn } from "@aov/ui/lib/utils"
import { localized } from "./hero-content"
import {
  KIND_LABELS,
  SOURCE_LABELS,
  UNIT_LABELS,
  skillFieldLabel,
  statLabel,
  type ChangeKind,
} from "./patch-change-model"
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
  summary?: string
  actualLocale?: string
  changes: RecordedChange[]
}

const kindTone: Partial<Record<string, string>> = {
  BUFF: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  NERF: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  REWORK: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  FIX: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
}

export function KindBadge({ kind, className }: { kind: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", kindTone[kind], className)}>
      {KIND_LABELS[kind as ChangeKind] ?? kind}
    </Badge>
  )
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

/** One readable line per recorded change: what changed, from what, to what. */
export function ChangeLines({
  changes,
  content,
  locale,
  className,
}: {
  changes: RecordedChange[]
  content?: Content | null
  locale: string
  className?: string
}) {
  const skillName = (key: unknown) =>
    localized(content?.SKILLS?.skills.find((skill) => skill.skillKey === key)?.translations, locale)?.name ?? text(key)
  return (
    <ul className={cn("divide-y rounded-lg border", className)}>
      {changes.map((change) => {
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
          case "HERO_SKILL_CHANGE":
            subject = `${skillName(change.skillKey)} · ${skillFieldLabel(String(change.fieldKey))}`
            before = change.oldValue
            after = change.newValue
            break
          case "HERO_ROLE_CHANGE":
            subject = `${change.added ? "Thêm" : "Bỏ"} vai trò ${ROLES[change.roleCode as Role] ?? text(change.roleCode)}`
            break
          case "HERO_VISUAL_CHANGE":
            subject = `Ảnh ${text(change.mediaRole).toLowerCase()}`
            detail = "Đổi ảnh tướng"
            break
          case "HERO_MECHANIC_CHANGE":
            subject = `Cơ chế: ${text(change.mechanicKey)}`
            detail = text(change.description)
            break
          default:
            subject = "Khác"
            detail = text(change.description)
        }
        const long = String(before ?? "").length > 40 || String(after ?? "").length > 40
        return (
          <li key={change.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 p-2.5 text-sm">
            <KindBadge kind={change.changeKind} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{subject}</span>
              {detail && <span className="block whitespace-pre-wrap text-muted-foreground">{detail}</span>}
              {(before !== undefined || after !== undefined) &&
                (long ? (
                  <span className="mt-1 grid gap-1 text-xs">
                    <span className="rounded bg-red-500/5 p-1.5 whitespace-pre-wrap text-muted-foreground line-through decoration-red-500/40">
                      {text(before)}
                    </span>
                    <span className="rounded bg-emerald-500/5 p-1.5 whitespace-pre-wrap">{text(after)}</span>
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center gap-1.5 tabular-nums">
                    <span className="text-muted-foreground">{text(before)}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{text(after)}</span>
                  </span>
                ))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
