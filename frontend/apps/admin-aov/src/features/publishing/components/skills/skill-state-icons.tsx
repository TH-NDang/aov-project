import { useEffect, useRef, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { SkillStateToggle } from "@aov/ui/components/skill-kit"
import { AssetPicker } from "../assets/asset-picker"
import { HeroAsset } from "../editing/hero-asset"
import type { Skill, SkillStateIcon } from "../../api/types"

export const MAX_STATE_ICONS = 10

export const stateIconsOf = (skill: Skill): SkillStateIcon[] => skill.stateIcons ?? []

/** The skill as it looks in one of its states: the same skill with that state's icon. */
export function skillInState(skill: Skill, state: number | null): Skill {
  const icon = state === null ? undefined : stateIconsOf(skill)[state]
  return icon ? { ...skill, iconAssetId: icon.assetId } : skill
}

/** The state names already used by a hero, most used first, so a new state can reuse the same words. */
export function knownStateLabels(skills: readonly Skill[]) {
  const counts = new Map<string, number>()
  for (const skill of skills)
    for (const icon of stateIconsOf(skill)) {
      const label = icon.label.trim()
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
    }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label)
}

/**
 * Names to offer for a state: those the hero already uses, then the terms its description marks with angle brackets,
 * such as the sea monster form of Billow, which is how the game names a state. The skill's own name is left out.
 */
/** A marked game term naming a state, not a text style tag such as "color=#5AADC9", "/b" or "br". */
const gameTerm = (text: string) =>
  /^[\p{L}\p{N} '-]{2,64}$/u.test(text) && (/[^\u0020-\u007E]/.test(text) || /[A-Z ]/.test(text))

export function stateLabelHints(skill: Skill, known: readonly string[]) {
  const names = new Set(skill.translations.map((text) => text.name.trim()))
  const marked = skill.translations.flatMap((text) =>
    [...text.description.matchAll(/<([^<>\n]{1,64})>/g)].map((match) => match[1].trim()),
  )
  return [...new Set([...known, ...marked.filter(gameTerm)])].filter((label) => label && !names.has(label))
}

/**
 * Pictures of one skill in other states, such as a form that only swaps its icon. The skill keeps its single name,
 * description and numbers; each state adds an icon and a name.
 */
export function SkillStateIconsEditor({
  skill,
  suggestions,
  focusIndex,
  onChange,
  onBusyChange,
}: {
  skill: Skill
  /** State names used elsewhere on this hero. */
  suggestions: readonly string[]
  /** A state just added from elsewhere, whose name field takes the focus. */
  focusIndex?: number | null
  onChange: (icons: SkillStateIcon[]) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const icons = stateIconsOf(skill)
  const [adding, setAdding] = useState(false)
  const fields = useRef<(HTMLInputElement | null)[]>([])
  const listId = `skill-state-names-${skill.skillKey}`
  useEffect(() => {
    if (focusIndex === null || focusIndex === undefined) return
    // The sheet lays out first; the name is then brought into view and focused.
    const frame = requestAnimationFrame(() => {
      const field = fields.current[focusIndex]
      field?.scrollIntoView({ block: "center" })
      field?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusIndex])
  const used = new Set([skill.iconAssetId, ...icons.map((icon) => icon.assetId)])
  const full = icons.length >= MAX_STATE_ICONS

  return (
    <section className="space-y-3" aria-label="Ảnh theo trạng thái">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="type-label">Ảnh theo trạng thái</h3>
        {!adding && (
          <Button type="button" size="sm" variant="ghost" disabled={full} onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Thêm trạng thái
          </Button>
        )}
      </div>
      <p className="type-meta">
        Dùng khi chiêu chỉ đổi biểu tượng ở một trạng thái, còn tên, mô tả và thông số giữ nguyên. Ảnh chính là trạng
        thái thường.
      </p>
      <datalist id={listId}>
        {suggestions.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      {icons.length > 0 && (
        <ul className="grid gap-2">
          {icons.map((icon, index) => (
            <li key={icon.assetId} className="flex items-center gap-3 rounded-lg border p-2">
              <HeroAsset id={icon.assetId} className="size-10 shrink-0 rounded-full" frameAspectRatio={1} />
              <label className="min-w-0 flex-1">
                <span className="sr-only">Tên trạng thái</span>
                <Input
                  ref={(node) => {
                    fields.current[index] = node
                  }}
                  value={icon.label}
                  maxLength={64}
                  required
                  list={listId}
                  placeholder="Ví dụ: Hải quái"
                  onChange={(event) =>
                    onChange(icons.map((row, n) => (n === index ? { ...row, label: event.target.value } : row)))
                  }
                />
              </label>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                aria-label={`Bỏ trạng thái ${icon.label || index + 1}`}
                title="Bỏ trạng thái này"
                onClick={() => onChange(icons.filter((_, n) => n !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="type-meta">Chọn hoặc tải biểu tượng của trạng thái, rồi đặt tên trạng thái.</p>
          <AssetPicker
            semanticType="HERO_SKILL_ICON"
            value={null}
            onBusyChange={onBusyChange}
            directUpload
            onChange={(assetId) => {
              if (!assetId || used.has(assetId)) return
              onChange([...icons, { assetId, label: suggestions[0] ?? "" }])
              setAdding(false)
            }}
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Hủy
          </Button>
        </div>
      )}
    </section>
  )
}

/** Normal first, then each named state; picking one only swaps the skill's icon. */
export function SkillStateSwitch({
  skill,
  state,
  onState,
}: {
  skill: Skill
  state: number | null
  onState: (state: number | null) => void
}) {
  return <SkillStateToggle states={stateIconsOf(skill).map((icon) => icon.label)} value={state} onChange={onState} />
}
