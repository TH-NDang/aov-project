import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ListChecks, MessageSquareText, Pencil, Sparkles } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { confirmAction, confirmDiscard } from "@/components/confirm-dialog"
import { SectionHeading, sectionFrame } from "@/components/section-contents"
import { errorMessage, isApiError } from "@/lib/api/errors"
import { createPublishingApi, heroPreviewKey } from "./publishing-api"
import { heroRatingScale } from "./hero-rating-scale"
import { selectSkillTranslation, skillLabel } from "./hero-skills"
import { draftHeroNotes } from "./hero-notes-draft"
import {
  TRAITS,
  TRAIT_DETAIL_MAX,
  TRAIT_GROUPS,
  cleanTraits,
  suggestTraits,
  traitDetail,
  traitInfo,
  withTraitDetail,
  type TraitSuggestion,
} from "./hero-traits"
import type { Content, HeroNotes, Revision, Skill, Trait, TraitCode } from "./types"

const api = createPublishingApi(backendRequest)
const NOTE_MAX = 4000
const NOTE_FIELDS = [
  ["strengths", "Điểm mạnh"],
  ["weaknesses", "Điểm yếu"],
  ["counterTips", "Cách khắc chế"],
] as const
type NoteField = (typeof NOTE_FIELDS)[number][0]

const skillName = (skill: Skill, locale: string) =>
  `${skillLabel(skill)} · ${selectSkillTranslation(skill, locale)?.name || skill.skillKey}`

/** Saves through the evaluation's own endpoints, then reads the draft again so every part of the page agrees. */
function useEvaluationSave(heroId: string | undefined, revision: Revision | undefined) {
  const client = useQueryClient()
  return async (write: (revision: Revision) => Promise<unknown>) => {
    if (!heroId || !revision) throw new Error("Chưa có bản nháp để lưu.")
    await write(revision)
    client.setQueryData(heroPreviewKey(heroId, revision.id), await api.read(heroId, revision.id))
    await Promise.all([
      client.invalidateQueries({ queryKey: ["publishing-revisions", heroId] }),
      client.invalidateQueries({ queryKey: ["hero-draft-changes", heroId] }),
      client.invalidateQueries({ queryKey: ["publishing-heroes"] }),
    ])
  }
}

function saveError(error: unknown) {
  if (isApiError(error, "HERO_REVISION_VERSION_CONFLICT"))
    return "Bản nháp vừa được lưu ở nơi khác. Tải lại trang để xem bản mới rồi sửa lại."
  return errorMessage(error)
}

export interface HeroEvaluationProps {
  heroId?: string
  revision?: Revision
  content: Content
  locale: string
  editable: boolean
  busy: boolean
  /** Another part of the page is open in its editor. */
  locked: boolean
  onNeedsDraft?: () => void
}

/**
 * The editor's evaluation of a hero (ADR-029): the yes/no traits confirmed from the skill kit, then the strengths,
 * weaknesses and counter tips. Both are saved straight into the draft through their own endpoints.
 */
export function HeroEvaluation(props: HeroEvaluationProps) {
  return (
    <div className="min-w-0 space-y-6">
      <HeroTraitsSection {...props} />
      <HeroNotesSection {...props} />
    </div>
  )
}

/** The pencil of a part: it asks for a draft first on a published version, and waits while another part is open. */
function EditButton({
  label,
  editable,
  busy,
  locked,
  onNeedsDraft,
  onEdit,
}: {
  label: string
  editable: boolean
  busy: boolean
  locked: boolean
  onNeedsDraft?: () => void
  onEdit: () => void
}) {
  if (!editable && !onNeedsDraft) return null
  const title = locked
    ? `${label} · lưu hoặc hủy phần đang sửa trước`
    : editable
      ? label
      : `${label} · tạo bản nháp trước`
  const disabled = busy || locked
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={title}
      title={title}
      aria-disabled={disabled}
      className="size-8 shrink-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={() => {
        if (disabled) return
        if (editable) onEdit()
        else onNeedsDraft?.()
      }}
    >
      <Pencil className="size-4" />
    </Button>
  )
}

function Frame({
  title,
  icon,
  count,
  editing,
  actions,
  children,
}: {
  title: string
  icon: typeof ListChecks
  count?: number
  editing: boolean
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={cn("min-w-0", sectionFrame)}>
      <SectionHeading
        title={title}
        icon={icon}
        count={count}
        status={
          editing ? (
            <span className="type-meta inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
              <Pencil className="size-3" />
              Đang sửa
            </span>
          ) : undefined
        }
        actions={editing ? undefined : actions}
      />
      {children}
    </section>
  )
}

function HeroTraitsSection({
  heroId,
  revision,
  content,
  locale,
  editable,
  busy,
  locked,
  onNeedsDraft,
}: HeroEvaluationProps) {
  const [editing, setEditing] = useState(false)
  const skills = content.SKILLS?.skills ?? []
  const saved = cleanTraits(content.SKILLS?.traits ?? [], skills)
  const suggestions = useMemo(() => suggestTraits(skills), [skills])
  const waiting = suggestions.filter((suggestion) => !saved.some((trait) => trait.code === suggestion.code)).length

  return (
    <Frame
      title="Đặc điểm"
      icon={ListChecks}
      count={saved.length}
      editing={editing}
      actions={
        <EditButton
          label="Chỉnh sửa đặc điểm"
          editable={editable && !!skills.length}
          busy={busy}
          locked={locked}
          onNeedsDraft={skills.length ? onNeedsDraft : undefined}
          onEdit={() => setEditing(true)}
        />
      }
    >
      {editing ? (
        <TraitsEditor
          heroId={heroId}
          revision={revision}
          skills={skills}
          saved={saved}
          suggestions={suggestions}
          locale={locale}
          onClose={() => setEditing(false)}
        />
      ) : (
        <TraitsView traits={saved} skills={skills} locale={locale} waiting={waiting} hasSkills={!!skills.length} />
      )}
    </Frame>
  )
}

function TraitsView({
  traits,
  skills,
  locale,
  waiting,
  hasSkills,
}: {
  traits: Trait[]
  skills: Skill[]
  locale: string
  waiting: number
  hasSkills: boolean
}) {
  if (!traits.length)
    return (
      <p className="type-body text-muted-foreground">
        {!hasSkills
          ? "Thêm kỹ năng trước, đặc điểm được đánh dấu theo kỹ năng."
          : waiting
            ? `Chưa đánh dấu đặc điểm nào. Mô tả kỹ năng gợi ý ${waiting} đặc điểm để xem lại.`
            : "Chưa đánh dấu đặc điểm nào."}
      </p>
    )
  return (
    <div className="grid gap-4 @min-[720px]:grid-cols-2">
      {TRAIT_GROUPS.map((group) => {
        const rows = traits.filter((trait) => traitInfo(trait.code).group === group)
        if (!rows.length) return null
        return (
          <div key={group} className="min-w-0 space-y-2">
            <h3 className="type-label text-muted-foreground">{group}</h3>
            <ul className="space-y-2">
              {rows.map((trait) => {
                const detail = traitDetail(trait, locale)
                const names = skills
                  .filter((skill) => trait.skillKeys.includes(skill.skillKey))
                  .map((skill) => skillName(skill, locale))
                return (
                  <li key={trait.code} className="min-w-0 rounded-lg border px-3 py-2">
                    <p className="type-body">
                      <strong className="font-semibold">{traitInfo(trait.code).label}</strong>
                    </p>
                    {detail && <p className="type-body text-muted-foreground">{detail}</p>}
                    {names.length > 0 && <p className="type-meta">{names.join(" · ")}</p>}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function TraitsEditor({
  heroId,
  revision,
  skills,
  saved,
  suggestions,
  locale,
  onClose,
}: {
  heroId?: string
  revision?: Revision
  skills: Skill[]
  saved: Trait[]
  suggestions: TraitSuggestion[]
  locale: string
  onClose: () => void
}) {
  const [traits, setTraits] = useState<Trait[]>(saved)
  const [note, setNote] = useState("")
  const persist = useEvaluationSave(heroId, revision)
  const save = useMutation({
    mutationFn: () => persist((current) => api.saveTraits(current, cleanTraits(traits, skills), note.trim())),
    meta: { successMessage: "Đã lưu đặc điểm vào bản nháp." },
    onSuccess: onClose,
  })
  const changed = JSON.stringify(cleanTraits(traits, skills)) !== JSON.stringify(saved) || !!note.trim()
  const suggestionOf = (code: TraitCode) => suggestions.find((suggestion) => suggestion.code === code)
  // A suggested detail is Vietnamese, so another language starts with an empty line to write.
  const fromSuggestion = (suggestion: TraitSuggestion): Trait => ({
    code: suggestion.code,
    skillKeys: suggestion.skillKeys,
    translations: locale === "vi-VN" && suggestion.detail ? [{ locale, detail: suggestion.detail }] : [],
  })
  const missing = suggestions.filter((suggestion) => !traits.some((trait) => trait.code === suggestion.code))
  const toggle = (code: TraitCode, checked: boolean) => {
    if (!checked) return setTraits(traits.filter((trait) => trait.code !== code))
    const suggestion = suggestionOf(code)
    const restored = saved.find((trait) => trait.code === code)
    setTraits([
      ...traits,
      restored ?? (suggestion ? fromSuggestion(suggestion) : { code, skillKeys: [], translations: [] }),
    ])
  }
  const update = (code: TraitCode, change: (trait: Trait) => Trait) =>
    setTraits(traits.map((trait) => (trait.code === code ? change(trait) : trait)))
  const cancel = async () => {
    if (
      changed &&
      !(await confirmDiscard({
        title: "Bỏ các thay đổi đặc điểm?",
        description: "Những đặc điểm vừa đánh dấu hoặc sửa sẽ không được lưu.",
      }))
    )
      return
    onClose()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (changed) save.mutate()
  }

  return (
    <form className="space-y-5" onSubmit={submit} aria-label="Sửa đặc điểm">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!missing.length || save.isPending}
          onClick={() => setTraits([...traits, ...missing.map(fromSuggestion)])}
        >
          <Sparkles className="size-4" />
          {missing.length ? `Đánh dấu ${missing.length} gợi ý` : "Đã đánh dấu mọi gợi ý"}
        </Button>
        <span className="type-meta">
          Gợi ý đọc từ mô tả và nhãn kỹ năng tiếng Việt; kiểm tra từng dòng trước khi lưu.
        </span>
      </div>
      <fieldset disabled={save.isPending} className="grid min-w-0 gap-5 @min-[720px]:grid-cols-2">
        {TRAIT_GROUPS.map((group) => (
          <fieldset key={group} className="min-w-0 space-y-2">
            <legend className="type-label mb-2 text-muted-foreground">{group}</legend>
            {TRAITS.filter((info) => info.group === group).map((info) => {
              const trait = traits.find((entry) => entry.code === info.code)
              const suggestion = suggestionOf(info.code)
              const evidenceSkill = suggestion?.evidence
                ? skills.find((skill) => skill.skillKey === suggestion.evidence!.skillKey)
                : undefined
              return (
                <div
                  key={info.code}
                  className={cn(
                    "min-w-0 space-y-2 rounded-lg border px-3 py-2",
                    trait && "border-primary/40 bg-primary/5",
                  )}
                >
                  <label className="type-body flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={!!trait}
                      onChange={(event) => toggle(info.code, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1 font-semibold">{info.label}</span>
                    {suggestion && <span className="type-meta shrink-0 text-primary">Gợi ý</span>}
                  </label>
                  {suggestion?.evidence && (
                    <p className="type-meta break-words">
                      {evidenceSkill ? `${skillName(evidenceSkill, locale)}: ` : ""}“{suggestion.evidence.text}”
                    </p>
                  )}
                  {info.manual && !suggestion && (
                    <p className="type-meta">Mô tả kỹ năng hiếm khi ghi; đánh dấu khi đã thử trong trận.</p>
                  )}
                  {trait && (
                    <div className="space-y-2 pl-6">
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Kỹ năng cho ${info.label}`}>
                        {skills.map((skill) => {
                          const on = trait.skillKeys.includes(skill.skillKey)
                          return (
                            <Button
                              key={skill.skillKey}
                              type="button"
                              size="sm"
                              variant={on ? "secondary" : "outline"}
                              aria-pressed={on}
                              className={cn("h-8", on && "border border-primary/40 text-primary")}
                              onClick={() =>
                                update(info.code, (current) => ({
                                  ...current,
                                  skillKeys: on
                                    ? current.skillKeys.filter((key) => key !== skill.skillKey)
                                    : [...current.skillKeys, skill.skillKey],
                                }))
                              }
                            >
                              {skillName(skill, locale)}
                            </Button>
                          )
                        })}
                      </div>
                      <label className="grid gap-1">
                        <span className="type-label">Chi tiết</span>
                        <Input
                          value={traitDetail(trait, locale)}
                          maxLength={TRAIT_DETAIL_MAX}
                          onChange={(event) =>
                            update(info.code, (current) => withTraitDetail(current, locale, event.target.value))
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </fieldset>
        ))}
      </fieldset>
      <EditorFooter
        note={note}
        onNote={setNote}
        pending={save.isPending}
        error={save.isError ? saveError(save.error) : null}
        canSave={changed}
        saveLabel="Lưu đặc điểm"
        onCancel={() => void cancel()}
      />
    </form>
  )
}

function EditorFooter({
  note,
  onNote,
  pending,
  error,
  canSave,
  saveLabel,
  onCancel,
}: {
  note: string
  onNote: (value: string) => void
  pending: boolean
  error: string | null
  canSave: boolean
  saveLabel: string
  onCancel: () => void
}) {
  return (
    <div className="space-y-3 border-t pt-4">
      <label className="grid gap-1">
        <span className="type-label">Ghi chú thay đổi</span>
        <Input value={note} maxLength={NOTE_MAX} onChange={(event) => onNote(event.target.value)} disabled={pending} />
      </label>
      {error && (
        <p role="alert" className="type-meta text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={pending || !canSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

const notesOf = (content: Content, locale: string): Record<NoteField, string> => {
  const text = content.PROFILE?.translations.find((translation) => translation.locale === locale)
  return { strengths: text?.strengths ?? "", weaknesses: text?.weaknesses ?? "", counterTips: text?.counterTips ?? "" }
}

function HeroNotesSection({
  heroId,
  revision,
  content,
  locale,
  editable,
  busy,
  locked,
  onNeedsDraft,
}: HeroEvaluationProps) {
  const [editing, setEditing] = useState(false)
  const hasProfile = !!content.PROFILE?.translations.some((translation) => translation.locale === locale)
  const notes = notesOf(content, locale)
  const written = NOTE_FIELDS.filter(([key]) => notes[key])

  return (
    <Frame
      title="Mạnh, yếu và khắc chế"
      icon={MessageSquareText}
      editing={editing}
      actions={
        <EditButton
          label="Chỉnh sửa nhận định"
          editable={editable && hasProfile}
          busy={busy}
          locked={locked}
          onNeedsDraft={hasProfile ? onNeedsDraft : undefined}
          onEdit={() => setEditing(true)}
        />
      }
    >
      {editing ? (
        <NotesEditor
          heroId={heroId}
          revision={revision}
          content={content}
          locale={locale}
          saved={notes}
          onClose={() => setEditing(false)}
        />
      ) : !hasProfile ? (
        <p className="type-body text-muted-foreground">
          Hồ sơ chưa có bản ngôn ngữ này. Thêm tên tướng ở ngôn ngữ này trước khi viết nhận định.
        </p>
      ) : !written.length ? (
        <p className="type-body text-muted-foreground">Chưa viết nhận định. Wiki chỉ hiện phần đã viết.</p>
      ) : (
        <div className="grid gap-4 @min-[720px]:grid-cols-3">
          {NOTE_FIELDS.map(([key, label]) => (
            <div key={key} className="min-w-0 space-y-1">
              <h3 className="type-label text-muted-foreground">{label}</h3>
              {notes[key] ? (
                <ul className="type-body list-disc space-y-1 pl-5">
                  {notes[key]
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line, index) => (
                      <li key={index} className="break-words">
                        {line.replace(/^\s*[-•]\s*/, "")}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="type-meta">Chưa viết.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Frame>
  )
}

function NotesEditor({
  heroId,
  revision,
  content,
  locale,
  saved,
  onClose,
}: {
  heroId?: string
  revision?: Revision
  content: Content
  locale: string
  saved: Record<NoteField, string>
  onClose: () => void
}) {
  const [notes, setNotes] = useState(saved)
  const [note, setNote] = useState("")
  const persist = useEvaluationSave(heroId, revision)
  // The machine draft reads Vietnamese rules, so only the Vietnamese notes offer it.
  const drafting = locale === "vi-VN"
  const ranking = useQuery({
    queryKey: ["hero-ranking-reading", heroId],
    queryFn: () => api.ranking(heroId!),
    enabled: !!heroId && drafting,
    staleTime: 60000,
    retry: false,
  })
  const save = useMutation({
    mutationFn: () => {
      const value: HeroNotes = {
        strengths: notes.strengths.trim() || null,
        weaknesses: notes.weaknesses.trim() || null,
        counterTips: notes.counterTips.trim() || null,
      }
      return persist((current) => api.saveNotes(current, locale, value, note.trim()))
    },
    meta: { successMessage: "Đã lưu nhận định vào bản nháp." },
    onSuccess: onClose,
  })
  const changed = NOTE_FIELDS.some(([key]) => notes[key].trim() !== saved[key].trim()) || !!note.trim()
  const snapshot = ranking.data?.snapshot

  const fillDraft = async () => {
    const ratings = content.OVERVIEW_RATINGS
    const scale = ratings ? heroRatingScale(ratings.scaleCode) : null
    const draft = draftHeroNotes({
      traits: content.SKILLS?.traits ?? [],
      skills: content.SKILLS?.skills ?? [],
      roles: content.PROFILE?.roles ?? [],
      ranking: ranking.data,
      survivability:
        ratings && scale && Number.isFinite(ratings.survivability)
          ? { value: ratings.survivability / scale.factor, maximum: scale.maximum }
          : null,
    })
    if (
      NOTE_FIELDS.some(([key]) => notes[key].trim()) &&
      !(await confirmAction({
        title: "Thay bằng bản nháp?",
        description:
          "Nội dung đang có ở ba ô sẽ được thay bằng bản nháp soạn từ số liệu đấu hạng và các đặc điểm đã lưu.",
        confirmLabel: "Thay bằng bản nháp",
      }))
    )
      return
    setNotes({
      strengths: draft.strengths ?? "",
      weaknesses: draft.weaknesses ?? "",
      counterTips: draft.counterTips ?? "",
    })
  }
  const cancel = async () => {
    if (
      changed &&
      !(await confirmDiscard({
        title: "Bỏ các thay đổi nhận định?",
        description: "Nội dung vừa viết ở ba ô sẽ không được lưu.",
      }))
    )
      return
    onClose()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (changed) save.mutate()
  }

  return (
    <form className="space-y-5" onSubmit={submit} aria-label="Sửa nhận định">
      {drafting && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={save.isPending || ranking.isPending}
            onClick={() => void fillDraft()}
          >
            <Sparkles className="size-4" />
            Soạn nháp từ dữ liệu
          </Button>
          <span className="type-meta">
            {ranking.isPending
              ? "Đang đọc số liệu đấu hạng…"
              : snapshot
                ? `Số liệu: ${snapshot.modeLabel}, ${new Date(snapshot.capturedAt).toLocaleDateString("vi-VN")}${ranking.data?.entry ? "" : " (bảng chưa có tướng này)"}. Đặc điểm: ${content.SKILLS?.traits?.length ?? 0} đã lưu.`
                : `Chưa có bảng đấu hạng đã xác nhận; bản nháp chỉ dùng ${content.SKILLS?.traits?.length ?? 0} đặc điểm đã lưu.`}
          </span>
        </div>
      )}
      <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 @min-[720px]:grid-cols-3">
        {NOTE_FIELDS.map(([key, label]) => (
          <label key={key} className="grid min-w-0 content-start gap-1">
            <span className="type-label">{label}</span>
            <Textarea
              className="min-h-40"
              value={notes[key]}
              maxLength={NOTE_MAX}
              onChange={(event) => setNotes({ ...notes, [key]: event.target.value })}
            />
            <span className="type-meta">Mỗi ý một dòng.</span>
          </label>
        ))}
      </fieldset>
      <EditorFooter
        note={note}
        onNote={setNote}
        pending={save.isPending}
        error={save.isError ? saveError(save.error) : null}
        canSave={changed}
        saveLabel="Lưu nhận định"
        onCancel={() => void cancel()}
      />
    </form>
  )
}
