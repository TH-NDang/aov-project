import { useId } from "react"
import { Input } from "@aov/ui/components/input"
import { AdminEntityText } from "../../../terminology/catalog"
import type { Skill } from "../../api/types"

/** A cost line as the game writes it: a label, then a value, in one colour. */
export interface CostText {
  label: string
  value: string
  /** Kept as found; a new line takes the colour of its kind. */
  color: string | null
}

/** The colours the game uses: orange for a cooldown, blue for energy and inner power. */
export const COOLDOWN_COLOR = "#FF8941"
export const ENERGY_COLOR = "#74D4FA"

const simple = /^\s*(?:<color=(#[0-9a-f]{6})>)?([^<>]*?)(?:<\/color>)?\s*$/i

/** Reads a line such as `<color=#FF8941>Label: 10s</color>`; null when the text holds markup this form cannot keep. */
export function parseCostText(display: string): CostText | null {
  if (!display.trim()) return { label: "", value: "", color: null }
  const match = simple.exec(display)
  if (!match) return null
  const inner = match[2]!
  const colon = inner.indexOf(":")
  return colon < 0
    ? { label: "", value: inner.trim(), color: match[1] ?? null }
    : { label: inner.slice(0, colon).trim(), value: inner.slice(colon + 1).trim(), color: match[1] ?? null }
}

/** Writes the line back in the game's markup; an empty value means the skill has no such cost. */
export function composeCostText(cost: CostText, fallbackColor: string) {
  const value = cost.value.trim()
  if (!value) return ""
  const text = cost.label.trim() ? `${cost.label.trim()}: ${value}` : value
  return `<color=${cost.color ?? fallbackColor}>${text}</color>`
}

/** Seconds when the value is a plain duration such as `10s`, or 12,5 followed by the Vietnamese word for seconds. */
export function costSeconds(value: string) {
  const match = /^(\d+(?:[.,]\d+)?)\s*(?:s|giây)$/i.exec(value.trim())
  return match ? Number(match[1]!.replace(",", ".")) : null
}

/** A number when the value is only a number, such as an energy cost of `40`. */
export function costNumber(value: string) {
  return /^\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.trim().replace(",", ".")) : null
}

/**
 * A cost written as label and value, with the game's colour added for the reader. Text this form cannot represent,
 * such as nested markup, stays editable as written.
 */
export function SkillCostField({
  title,
  display,
  labels,
  defaultLabel,
  color,
  valuePlaceholder,
  onChange,
  onStyleChange,
}: {
  title: string
  display: string
  /** Labels the game uses for this line, offered while typing. */
  labels: readonly string[]
  defaultLabel: string
  color: string
  valuePlaceholder: string
  onChange: (display: string, cost: CostText | null) => void
  /** Label and colour are shared by the hero's skills; a change here goes to all of them. */
  onStyleChange?: (style: CostStyle) => void
}) {
  const id = useId()
  const parsed = parseCostText(display)
  if (!parsed)
    return (
      <label className="grid gap-1.5">
        <span className="type-label">{title}</span>
        <Input value={display} onChange={(event) => onChange(event.target.value, null)} />
        <span className="type-meta">Dòng này có định dạng riêng nên được sửa nguyên văn.</span>
      </label>
    )
  const cost = { ...parsed, label: parsed.label || (parsed.value ? "" : defaultLabel) }
  const update = (change: Partial<CostText>) => {
    const next = { ...cost, ...change }
    onChange(composeCostText(next, color), next)
  }
  const updateStyle = (change: Partial<CostText>) => {
    const next = { ...cost, ...change }
    if (onStyleChange) onStyleChange({ label: next.label, color: next.color ?? color })
    else update(change)
  }
  return (
    <fieldset className="grid min-w-0 gap-1.5">
      <legend className="type-label mb-1.5">{title}</legend>
      <div className="grid grid-cols-[2.25rem_minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <label className="min-w-0" title="Màu của dòng này">
          <span className="sr-only">Màu {title.toLowerCase()}</span>
          <input
            type="color"
            className="h-9 w-9 cursor-pointer rounded-md border bg-background p-1"
            value={(cost.color ?? color).toLowerCase()}
            onChange={(event) => updateStyle({ color: event.target.value.toUpperCase() })}
          />
        </label>
        <label className="min-w-0">
          <span className="sr-only">Nhãn {title.toLowerCase()}</span>
          <Input
            list={`${id}-labels`}
            value={cost.label}
            placeholder={defaultLabel}
            maxLength={40}
            onChange={(event) => updateStyle({ label: event.target.value })}
          />
        </label>
        <label className="min-w-0">
          <span className="sr-only">Giá trị {title.toLowerCase()}</span>
          <Input
            value={cost.value}
            placeholder={valuePlaceholder}
            maxLength={120}
            onChange={(event) => update({ value: event.target.value })}
          />
        </label>
      </div>
      <datalist id={`${id}-labels`}>
        {labels.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      <p className="type-meta flex min-h-5 flex-wrap items-center gap-1.5">
        {display ? (
          <>
            Hiển thị: <AdminEntityText text={display} />
          </>
        ) : (
          "Để trống giá trị nếu chiêu không có dòng này."
        )}
      </p>
      {onStyleChange && <p className="type-meta">Nhãn và màu dùng chung cho mọi chiêu của tướng.</p>}
    </fieldset>
  )
}

export interface CostStyle {
  label: string
  color: string
}

export type CostField = "cooldown" | "energyCost"

type Metadata = Record<string, unknown>
const record = (value: unknown): Metadata | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Metadata) : null
const snapshotIndex = (skill: Skill) => skill.effects.findIndex((effect) => effect.effectType === "SOURCE_SNAPSHOT")

/** The label and colour a hero already uses for one line, read off the first skill that has it. */
export function sharedCostStyle(skills: readonly Skill[], field: CostField): CostStyle | undefined {
  for (const skill of skills) {
    const display = record(skill.effects[snapshotIndex(skill)]?.metadata[field])?.display
    const cost = typeof display === "string" ? parseCostText(display) : null
    if (cost?.value)
      return { label: cost.label, color: cost.color ?? (field === "cooldown" ? COOLDOWN_COLOR : ENERGY_COLOR) }
  }
}

/** Rewrites one line of every skill with the shared label and colour, keeping each skill's own value. */
export function applyCostStyle(skills: readonly Skill[], field: CostField, style: CostStyle): Skill[] {
  return skills.map((skill) => {
    const index = snapshotIndex(skill)
    if (index < 0) return skill
    const metadata = skill.effects[index]!.metadata
    const line = record(metadata[field])
    const cost = typeof line?.display === "string" ? parseCostText(line.display) : null
    if (!line || !cost?.value) return skill
    const display = composeCostText({ label: style.label, value: cost.value, color: style.color }, style.color)
    const next = { ...line, display, label: style.label.trim() || undefined }
    return {
      ...skill,
      effects: skill.effects.map((effect, n) =>
        n === index ? { ...effect, metadata: { ...metadata, [field]: next } } : effect,
      ),
    }
  })
}
