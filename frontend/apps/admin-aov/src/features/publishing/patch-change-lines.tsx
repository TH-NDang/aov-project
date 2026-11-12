import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, ChevronRight, ExternalLink, FileText, GitCompareArrows, History } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { confirmAction } from "@/components/confirm-dialog"
import { errorMessage } from "@/lib/api/errors"
import { control } from "./fields"
import { ChangeKindBadge } from "./hero-change-badges"
import { cn } from "@aov/ui/lib/utils"
import { AdminEntityText } from "../terminology/catalog"
import { selectSkillTranslation } from "./hero-skills"
import { markDescriptionChanges, mechanicSkillKey } from "./patch-description-marks"
import { SOURCE_LABELS, UNIT_LABELS, isHttpUrl, skillFieldLabel, statLabel } from "./patch-change-model"
import { formatPatchValue } from "./patch-value"
import { SkillChangeList } from "./skill-change-list"
import { compareSkillRanks, splitSkillRanks } from "./skill-rank-values"
import { SkillRankComparison, SkillRankPartsComparison } from "./skill-rank-table"
import { ROLES, type ChangeSource, type Content, type Role, type Skill } from "./types"

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
  changeSetId,
  canRecordPrevious = false,
}: {
  changes: RecordedChange[]
  content?: Content | null
  heroId?: string
  locale: string
  className?: string
  /** The change set the rows belong to; with `canRecordPrevious`, a mechanic row can take its earlier description. */
  changeSetId?: string
  canRecordPrevious?: boolean
}) {
  const skills = content?.SKILLS?.skills ?? []
  // A mechanic note names its skill the way the patch notes do; it joins that skill's card, icon and all.
  const skillKeyOf = (change: RecordedChange) =>
    change.type === "HERO_SKILL_CHANGE" && typeof change.skillKey === "string"
      ? change.skillKey
      : change.type === "HERO_MECHANIC_CHANGE"
        ? mechanicSkillKey(text(change.mechanicKey), skills)
        : undefined
  return (
    <SkillChangeList
      entries={changes}
      skillKeyOf={skillKeyOf}
      skills={skills}
      heroId={heroId}
      locale={locale}
      className={className}
      groupAction={(skillKey) => (
        <SkillDescriptionChange
          skill={skills.find((skill) => skill.skillKey === skillKey)}
          changes={changes.filter((change) => skillKeyOf(change) === skillKey)}
          locale={locale}
        />
      )}
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
            // Inside its skill's card the skill is already named by the header.
            subject = skill ? "Cơ chế" : `Cơ chế: ${skillFieldLabel(text(change.mechanicKey))}`
            break
          default:
            subject = "Khác"
            detail = text(change.description)
        }
        const long = String(before ?? "").length > 40 || String(after ?? "").length > 40
        const parts =
          change.type === "HERO_SKILL_CHANGE" ? splitSkillRanks(change.oldValue, change.newValue, skill, skill) : null
        const ranks =
          change.type === "HERO_SKILL_CHANGE" && !parts
            ? compareSkillRanks(change.oldValue, change.newValue, skill, skill)
            : null
        const standalone = change.type !== "HERO_SKILL_CHANGE" && !skill
        return (
          <li key={change.id} className={cn("py-2.5 text-sm", standalone && "border-b px-3")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{subject}</span>
                <KindBadge kind={change.changeKind} />
              </div>
              {detail && <span className="block whitespace-pre-wrap text-muted-foreground">{detail}</span>}
              {change.type === "HERO_MECHANIC_CHANGE" && (
                <MechanicChangeText
                  change={change}
                  changeSetId={changeSetId}
                  canRecord={canRecordPrevious && !!changeSetId}
                />
              )}
              {parts ? (
                <div className="mt-2">
                  <SkillRankPartsComparison
                    data={parts}
                    label={skillFieldLabel(String(change.fieldKey))}
                    locale={locale}
                  />
                </div>
              ) : ranks ? (
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

/**
 * Under a skill's changes, its description from the version on screen. Where the description shows a changed number
 * it reads "350 → 500", so a change the level table does not carry, such as a share of magic attack, is still seen.
 * Without such a number, the description stays folded for reference, which is what a rework needs.
 */
function SkillDescriptionChange({
  skill,
  changes,
  locale,
}: {
  skill?: Skill
  changes: RecordedChange[]
  locale: string
}) {
  const description = skill && selectSkillTranslation(skill, locale)?.description
  if (!description) return null
  const marked = markDescriptionChanges(
    description,
    changes
      .filter((change) => change.type === "HERO_SKILL_CHANGE")
      .map((change) => ({ oldValue: change.oldValue, newValue: change.newValue })),
    skill,
  )
  if (marked.marks)
    return (
      <div className="space-y-1 border-t py-2.5">
        <p className="type-label">
          Trong mô tả <span className="type-meta">· số cũ → số mới</span>
        </p>
        <p className="type-body whitespace-pre-wrap break-words leading-7 [overflow-wrap:anywhere]">
          <AdminEntityText text={marked.text} />
        </p>
      </div>
    )
  return (
    <details className="group/description border-t py-2">
      <summary className="type-meta inline-flex min-h-8 cursor-pointer list-none items-center gap-1 hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-open/description:rotate-90" />
        Xem mô tả trong bản đang mở
      </summary>
      <p className="type-body mt-1 whitespace-pre-wrap break-words leading-7 [overflow-wrap:anywhere]">
        <AdminEntityText text={description} />
      </p>
    </details>
  )
}

type PreviousMechanic = { description: string; sourceUrl: string; recordedAt: string }

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * A mechanic note reads as what the mechanic became. Once its earlier behaviour is written from a cited source, the row
 * reads as a before line and an after line. The earlier text is added once and never edited (ADR-016), so saving asks first.
 */
function MechanicChangeText({
  change,
  changeSetId,
  canRecord,
}: {
  change: RecordedChange
  changeSetId?: string
  canRecord: boolean
}) {
  const queryClient = useQueryClient()
  const [writing, setWriting] = useState(false)
  const [description, setDescription] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const previous = change.previous as PreviousMechanic | null | undefined
  const now = text(change.description)

  if (previous)
    return (
      <span className="type-body mt-1 grid gap-1.5">
        <span className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-2 rounded-md bg-muted/30 px-2 py-1.5">
          <span className="type-meta">Trước</span>
          <span className="whitespace-pre-wrap break-words">
            {previous.description}{" "}
            <a
              href={previous.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="type-meta inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline"
            >
              Nguồn: {hostOf(previous.sourceUrl)}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          </span>
        </span>
        <span className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-2 rounded-md bg-muted/50 px-2 py-1.5">
          <span className="type-meta">Sau</span>
          <span className="whitespace-pre-wrap break-words">{now}</span>
        </span>
      </span>
    )

  async function save() {
    const value = { description: description.trim(), sourceUrl: sourceUrl.trim() }
    if (!value.description) return setError("Viết mô tả trước khi đổi.")
    if (!isHttpUrl(value.sourceUrl)) return setError("Link nguồn phải bắt đầu bằng http:// hoặc https://.")
    const accepted = await confirmAction({
      title: "Lưu mô tả trước khi đổi?",
      description: "Lịch sử thay đổi chỉ cho thêm: sau khi lưu, mô tả và link nguồn không sửa hay xóa được.",
      confirmLabel: "Lưu",
    })
    if (!accepted) return
    setBusy(true)
    setError("")
    try {
      await backendRequest(`/admin/hero-changes/${changeSetId}/mechanics/${change.id}/previous`, {
        method: "POST",
        body: JSON.stringify(value),
      })
      await queryClient.invalidateQueries({ queryKey: ["patch-changes"] })
      setWriting(false)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <span className="block whitespace-pre-wrap text-muted-foreground">{now}</span>
      {canRecord && !writing && (
        <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => setWriting(true)}>
          <History aria-hidden className="size-4" /> Ghi mô tả trước khi đổi
        </Button>
      )}
      {writing && (
        <form
          className="mt-2 grid gap-2 rounded-lg border p-3"
          aria-label="Mô tả trước khi đổi"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="grid gap-1.5">
            <span className="type-label">Trước khi đổi</span>
            <textarea
              className={cn(control, "min-h-20")}
              value={description}
              disabled={busy}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="type-label">Link nguồn</span>
            <input
              className={control}
              type="url"
              placeholder="https://…"
              value={sourceUrl}
              disabled={busy}
              onChange={(event) => setSourceUrl(event.target.value)}
            />
          </label>
          <p className="type-meta">Tự viết lại bằng lời của bạn, không chép nguyên văn từ nguồn.</p>
          {error && (
            <p role="alert" className="type-body text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setWriting(false)}>
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
