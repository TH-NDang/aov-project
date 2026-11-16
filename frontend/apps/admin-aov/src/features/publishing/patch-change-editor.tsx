import { useId, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeftRight, ArrowRight, Link2, Plus, Sparkles, Swords, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { ChangeKindSelect } from "./change-kind-select"
import { createPublishingApi } from "./publishing-api"
import {
  KIND_LABELS,
  ROW_TYPE_LABELS,
  SKILL_FIELDS,
  UNIT_LABELS,
  changePayload,
  duplicateRows,
  emptyRow,
  isHttpUrl,
  rowProblem,
  skillOptions,
  statOptions,
  type ChangeKind,
  type ChangeRow,
  type ChangeRowType,
} from "./patch-change-model"
import { ROLES, type ChangeSource, type Content } from "./types"
import { HeroAsset } from "./hero-asset"
import { skillImageMatch, useHeroSkillImages } from "./skill-artwork"
import { SkillChangeList } from "./skill-change-list"
import { ActionStrip } from "@/components/action-strip"
import { selectSkillTranslation, skillLabel, skillVariantLabel } from "./hero-skills"
import { mechanicSkillKey } from "./patch-description-marks"

const api = createPublishingApi(backendRequest)
export const compactControl =
  "h-8 w-full min-w-0 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 aria-[invalid=true]:border-destructive"

export interface PatchChangeEditorProps {
  source: ChangeSource
  heroId: string
  variantId: string
  locale: string
  /** Snapshot whose stats and skills the rows pick from. */
  reference: Content | null
  fromRevisionId?: string | null
  toRevisionId?: string | null
  initialRows?: ChangeRow[]
  defaultSourceUrl?: string
  onSaved: (id: string) => void
  onCancel?: () => void
}

/** One form for both sources: rows pick keys from a snapshot, and patch notes also need a source link. */
export function PatchChangeEditor({
  source,
  heroId,
  variantId,
  locale,
  reference,
  fromRevisionId = null,
  toRevisionId = null,
  initialRows,
  defaultSourceUrl = "",
  onSaved,
  onCancel,
}: PatchChangeEditorProps) {
  const cache = useQueryClient()
  const notes = source === "PATCH_NOTES"
  const fieldsId = useId()
  const [rows, setRows] = useState<ChangeRow[]>(() => (initialRows?.length ? initialRows : [emptyRow("STAT")]))
  const starter = useRef(notes && !initialRows?.length ? rows[0].id : null)
  const [summary, setSummary] = useState("")
  const [sourceUrl, setSourceUrl] = useState(defaultSourceUrl)
  const [introduces, setIntroduces] = useState(false)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const types = (Object.keys(ROW_TYPE_LABELS) as ChangeRowType[]).filter((type) => !notes || type !== "VISUAL")
  const duplicates = notes ? duplicateRows(rows) : new Set<string>()
  const problems = new Map(
    rows.map((row) => [
      row.id,
      rowProblem(row, source) ?? (duplicates.has(row.id) ? "Dòng này trùng với một dòng phía trên." : null),
    ]),
  )
  const urlProblem = notes && !isHttpUrl(sourceUrl) ? "Dán liên kết ghi chú cập nhật chính thức (http/https)." : null
  const invalid = !summary.trim() || !!urlProblem || [...problems.values()].some(Boolean)
  const skills = notes ? [...(reference?.SKILLS?.skills ?? [])].sort((a, b) => a.displayOrder - b.displayOrder) : []
  // A skill without an icon of its own shows the hero's library picture, as the skills editor does.
  const library = useHeroSkillImages(notes ? heroId : undefined).data ?? []
  const update = (id: string, patch: Partial<ChangeRow>) => {
    if (starter.current === id) starter.current = null
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }
  function add(type: ChangeRowType, key = "") {
    const row = { ...emptyRow(type), key }
    const replace = starter.current
    starter.current = null
    setRows((current) => (replace && current.length === 1 && current[0].id === replace ? [row] : [...current, row]))
  }

  async function submit() {
    setChecked(true)
    if (invalid) return
    setBusy(true)
    setError("")
    try {
      const result = await api.send<{ id: string }>(`/admin/patch-variants/${variantId}/hero-changes`, "POST", {
        heroId,
        sourceKind: source,
        sourceUrl: sourceUrl.trim() || null,
        fromHeroRevisionId: fromRevisionId,
        toHeroRevisionId: toRevisionId,
        summaryTranslations: [{ locale, summary: summary.trim() }],
        changes: rows.map(changePayload),
        introducesHero: introduces,
      })
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["patch-changes"] }),
        cache.invalidateQueries({ queryKey: ["publishing-heroes"] }),
        cache.invalidateQueries({ queryKey: ["hero-patch-view", heroId] }),
      ])
      onSaved(result.id)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        {notes && (
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Nguồn ghi chú cập nhật</span>
            <span className="relative">
              <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="url"
                inputMode="url"
                className={cn(compactControl, "pl-8")}
                placeholder="https://lienquan.garena.vn/…"
                value={sourceUrl}
                aria-invalid={checked && !!urlProblem}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </span>
            {checked && urlProblem && <span className="text-xs text-destructive">{urlProblem}</span>}
          </label>
        )}
        <label className="flex items-start gap-2.5 rounded-md border p-2.5">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={introduces}
            onChange={(event) => setIntroduces(event.target.checked)}
          />
          <span className="grid gap-0.5">
            <span className="type-label">Tướng mới ra mắt ở bản này</span>
            <span className="type-meta">Wiki không hiện tướng ở các bản trước. Mỗi tướng chỉ đánh dấu ở một bản.</span>
          </span>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Tóm tắt</span>
          <textarea
            rows={2}
            className={cn(compactControl, "h-auto py-2")}
            placeholder="Tóm tắt thay đổi của tướng…"
            value={summary}
            aria-invalid={checked && !summary.trim()}
            onChange={(event) => setSummary(event.target.value)}
          />
          {checked && !summary.trim() && <span className="text-xs text-destructive">Viết một câu tóm tắt.</span>}
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Các dòng thay đổi</span>
            <span className="text-xs text-muted-foreground">{rows.length} dòng</span>
          </div>
          {skills.length > 0 && (
            <ActionStrip aria-label="Thêm thay đổi theo kỹ năng">
              {skills.map((skill) => {
                const name = selectSkillTranslation(skill, locale)?.name
                const label = [skillLabel(skill), skillVariantLabel(skill, skills)].filter(Boolean).join(" · ")
                const Icon = skill.kind === "PASSIVE" ? Sparkles : Swords
                const iconId = skill.iconAssetId || skillImageMatch(skill, library)?.assetId
                return (
                  <Button
                    key={skill.skillKey}
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Thêm thay đổi · ${[label, name].filter(Boolean).join(" · ")}`}
                    title={name}
                    onClick={() => add("SKILL", skill.skillKey)}
                  >
                    {iconId ? (
                      <HeroAsset id={iconId} frameAspectRatio={1} className="size-6 rounded-md" />
                    ) : (
                      <Icon aria-hidden className="size-4" />
                    )}
                    {label}
                    {name && <span className="max-w-32 truncate font-normal text-muted-foreground">{name}</span>}
                  </Button>
                )
              })}
            </ActionStrip>
          )}
          <SkillChangeList
            entries={rows}
            skillKeyOf={(row) =>
              row.type === "SKILL" && reference?.SKILLS?.skills.some((skill) => skill.skillKey === row.key)
                ? row.key
                : row.type === "MECHANIC"
                  ? mechanicSkillKey(row.key, reference?.SKILLS?.skills)
                  : undefined
            }
            skills={reference?.SKILLS?.skills}
            locale={locale}
            heroId={heroId}
            groupAction={(key) => {
              const skill = reference?.SKILLS?.skills.find((item) => item.skillKey === key)
              return (
                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => add("SKILL", key)}>
                    <Plus aria-hidden className="size-4" /> Thêm dòng trong nhóm
                  </Button>
                  {/* A rework rewrites the skill without numbers to compare; its note is named the way the patch
                      notes name the skill, so the history files it under this card. */}
                  {skill && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => add("MECHANIC", skillLabel(skill))}>
                      <Plus aria-hidden className="size-4" /> Ghi cơ chế hoặc làm lại
                    </Button>
                  )}
                </div>
              )
            }}
            renderRow={(row, skill) => (
              <ChangeRowEditor
                key={row.id}
                index={rows.indexOf(row)}
                grouped={!!skill}
                fieldsId={fieldsId}
                row={row}
                types={types}
                reference={reference}
                locale={locale}
                problem={checked ? problems.get(row.id) : null}
                canRemove={rows.length > 1}
                onChange={(patch) => update(row.id, patch)}
                onRemove={() => setRows((current) => current.filter((item) => item.id !== row.id))}
              />
            )}
          />
          <datalist id={fieldsId}>
            {[...new Set(Object.values(SKILL_FIELDS))].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <ActionStrip aria-label="Thêm dòng thay đổi">
            {types
              .filter((type) => type !== "SKILL" || !skills.length)
              .map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => add(type)}
                >
                  <Plus className="size-3.5" />
                  {ROW_TYPE_LABELS[type]}
                </Button>
              ))}
          </ActionStrip>
        </div>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        {checked && invalid && (
          <span className="mr-auto text-xs text-destructive">Còn mục chưa hợp lệ, xem các dòng được đánh dấu.</span>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  )
}

function ChangeRowEditor({
  index,
  grouped,
  fieldsId,
  row,
  types,
  reference,
  locale,
  problem,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number
  grouped: boolean
  fieldsId: string
  row: ChangeRow
  types: ChangeRowType[]
  reference: Content | null
  locale: string
  problem?: string | null
  canRemove: boolean
  onChange: (patch: Partial<ChangeRow>) => void
  onRemove: () => void
}) {
  const stats = statOptions(reference)
  const skills = skillOptions(reference, locale)
  const stat = stats.find((option) => option.key === row.key)
  const label = `Dòng ${index + 1}`
  const [editingTarget, setEditingTarget] = useState(false)
  const showTarget = !grouped || editingTarget
  return (
    <li
      className={cn("space-y-2", grouped ? "py-2.5" : "rounded-lg border p-2.5", problem && "border-destructive/50")}
      aria-label={label}
    >
      <div className="flex flex-wrap items-center gap-2">
        {showTarget && (
          <select
            aria-label={`${label}: loại`}
            className={cn(compactControl, "w-28 shrink-0")}
            value={row.type}
            onChange={(event) =>
              onChange({ ...emptyRow(event.target.value as ChangeRowType), id: row.id, kind: row.kind })
            }
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {ROW_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        )}
        <ChangeKindSelect
          ariaLabel={`${label}: tính chất`}
          className="w-44 shrink-0"
          placeholder="Tính chất…"
          clearLabel="Chưa chọn"
          options={Object.entries(KIND_LABELS) as [ChangeKind, string][]}
          value={row.kind}
          onChange={(kind) => onChange({ kind })}
        />
        {grouped && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={editingTarget}
            onClick={() => setEditingTarget(!editingTarget)}
          >
            <ArrowLeftRight aria-hidden className="size-3.5" /> Đổi mục
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto size-7"
          disabled={!canRemove}
          aria-label={`Bỏ ${label.toLowerCase()}`}
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>
      {row.type === "STAT" && (
        <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_minmax(0,1fr)]">
          {stats.length ? (
            <select
              aria-label={`${label}: chỉ số`}
              className={compactControl}
              value={row.key}
              onChange={(event) => {
                const next = stats.find((option) => option.key === event.target.value)
                onChange({ key: event.target.value, unit: next?.unit ?? "" })
              }}
            >
              <option value="">Chọn chỉ số…</option>
              {stats.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={`${label}: mã chỉ số`}
              className={compactControl}
              placeholder="Mã chỉ số, ví dụ HP"
              value={row.key}
              onChange={(event) => onChange({ key: event.target.value.toUpperCase() })}
            />
          )}
          <ValueInput
            label={`${label}: trước`}
            value={row.oldValue}
            unit={row.unit}
            numeric
            onChange={(oldValue) => onChange({ oldValue })}
          />
          <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
          <ValueInput
            label={`${label}: sau`}
            value={row.newValue}
            unit={row.unit}
            numeric
            onChange={(newValue) => onChange({ newValue })}
          />
          {stat && stat.current !== null && (
            <span className="text-xs text-muted-foreground sm:col-span-4">
              Bản đang dùng làm mốc: {stat.current}
              {UNIT_LABELS[stat.unit] ?? ` ${stat.unit}`}
            </span>
          )}
        </div>
      )}
      {row.type === "SKILL" && (
        <div className="grid gap-2">
          <div className={cn("grid gap-2", showTarget && "sm:grid-cols-2")}>
            {showTarget &&
              (skills.length ? (
                <select
                  aria-label={`${label}: kỹ năng`}
                  className={compactControl}
                  value={row.key}
                  onChange={(event) => onChange({ key: event.target.value })}
                >
                  <option value="">Chọn kỹ năng…</option>
                  {skills.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={`${label}: mã kỹ năng`}
                  className={compactControl}
                  placeholder="Mã kỹ năng"
                  value={row.key}
                  onChange={(event) => onChange({ key: event.target.value })}
                />
              ))}
            <input
              aria-label={`${label}: trường thay đổi`}
              className={compactControl}
              list={fieldsId}
              placeholder="Trường: hồi chiêu, sát thương…"
              value={SKILL_FIELDS[row.field] ?? row.field}
              onChange={(event) => {
                const typed = event.target.value
                const known = Object.entries(SKILL_FIELDS).find(([, name]) => name === typed)?.[0]
                onChange({ field: known ?? typed })
              }}
            />
          </div>
          <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <ValueInput
              label={`${label}: trước`}
              value={row.oldValue}
              multiline={row.field === "description"}
              onChange={(oldValue) => onChange({ oldValue })}
            />
            <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
            <ValueInput
              label={`${label}: sau`}
              value={row.newValue}
              multiline={row.field === "description"}
              onChange={(newValue) => onChange({ newValue })}
            />
          </div>
        </div>
      )}
      {row.type === "ROLE" && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`${label}: vai trò`}
            className={cn(compactControl, "w-40")}
            value={row.key}
            onChange={(event) => onChange({ key: event.target.value })}
          >
            <option value="">Chọn vai trò…</option>
            {Object.entries(ROLES).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label={`${label}: thêm hay bỏ`}>
            {(
              [
                [true, "Thêm vai trò"],
                [false, "Bỏ vai trò"],
              ] as const
            ).map(([added, name]) => (
              <button
                key={name}
                type="button"
                aria-pressed={row.added === added}
                className={cn(
                  "h-7 rounded px-2.5 text-xs",
                  row.added === added ? "bg-secondary font-medium" : "text-muted-foreground",
                )}
                onClick={() => onChange({ added })}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
      {row.type === "VISUAL" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            aria-label={`${label}: loại ảnh`}
            className={compactControl}
            value={row.key}
            onChange={(event) => onChange({ key: event.target.value })}
          >
            <option value="">Loại ảnh…</option>
            <option value="HEAD">Ảnh đầu</option>
            <option value="PORTRAIT">Ảnh chân dung</option>
            <option value="SPLASH">Ảnh nền</option>
          </select>
          <ValueInput
            label={`${label}: mã ảnh trước`}
            value={row.oldValue}
            onChange={(oldValue) => onChange({ oldValue })}
          />
          <ValueInput
            label={`${label}: mã ảnh sau`}
            value={row.newValue}
            onChange={(newValue) => onChange({ newValue })}
          />
        </div>
      )}
      {row.type === "MECHANIC" && (
        // In a skill's card the card names the skill; the name field returns with the "change target" button.
        <div className={cn("grid gap-2", showTarget && "sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]")}>
          {showTarget && (
            <input
              aria-label={`${label}: tên cơ chế`}
              className={compactControl}
              placeholder="Tên cơ chế hoặc chiêu"
              value={row.key}
              onChange={(event) => onChange({ key: event.target.value })}
            />
          )}
          <ValueInput
            label={`${label}: mô tả`}
            value={row.description}
            multiline
            onChange={(description) => onChange({ description })}
          />
        </div>
      )}
      {row.type === "OTHER" && (
        <ValueInput
          label={`${label}: mô tả`}
          value={row.description}
          multiline
          onChange={(description) => onChange({ description })}
        />
      )}
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </li>
  )
}

function ValueInput({
  label,
  value,
  unit,
  numeric = false,
  multiline = false,
  onChange,
}: {
  label: string
  value: string
  unit?: string
  numeric?: boolean
  multiline?: boolean
  onChange: (value: string) => void
}) {
  const placeholder = label.endsWith("trước") ? "Trước" : label.endsWith("sau") ? "Sau" : "Mô tả"
  if (multiline)
    return (
      <textarea
        aria-label={label}
        rows={2}
        className={cn(compactControl, "h-auto py-1.5")}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  const suffix = unit ? UNIT_LABELS[unit] : ""
  return (
    <span className="relative block">
      <input
        aria-label={label}
        className={cn(compactControl, suffix && "pr-7")}
        inputMode={numeric ? "decimal" : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </span>
  )
}
