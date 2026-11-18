import { useEffect, useRef } from "react"
import { Settings2, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { EditorToolSheet } from "../editing/editor-tool-sheet"
import { Field, control } from "../editing/fields"
import { selectSkillTranslation, skillLabel, skillSlot } from "../../model/skills/hero-skills"
import type { Skill } from "../../api/types"

const kindLabels: Record<Skill["kind"], string> = { PASSIVE: "Nội tại", ACTIVE: "Chủ động", OTHER: "Khác" }
type Settings = Pick<Skill, "skillKey" | "kind" | "formKey">

const SLOT_KEY = /^skill-(\d+)-(\d+)$/
const SLOTS = [0, 1, 2, 3, 4, 5]
const slotName = (slot: number) => (slot === 0 ? "Nội tại" : `Chiêu ${slot}`)

/**
 * The key is made from the slot and the variant, so nobody types it. A key already saved stays as it is: references in
 * descriptions, videos and library pictures point at it.
 */
function SkillKeyFields({
  skill,
  draft,
  usedKeys,
  locked,
  onChange,
}: {
  skill: Skill
  draft: Settings
  usedKeys: ReadonlySet<string>
  locked: boolean
  onChange: (next: Settings) => void
}) {
  const variantField = useRef<HTMLInputElement>(null)
  const match = SLOT_KEY.exec(draft.skillKey)
  const slot = match ? Number(match[1]) : (skillSlot(skill) ?? 1)
  const variant = match ? Number(match[2]) : 1
  const taken = usedKeys.has(draft.skillKey)
  useEffect(() => {
    variantField.current?.setCustomValidity(taken ? "Đã có chiêu khác dùng ô và biến thể này." : "")
  }, [taken])

  if (locked)
    return (
      <div className="grid gap-1.5">
        <span className="type-label">Khóa kỹ năng</span>
        <code className="w-fit rounded-md bg-muted px-2 py-1 text-sm">{draft.skillKey}</code>
        <p className="type-meta">
          Khóa đã lưu nên giữ nguyên: tham chiếu trong mô tả, video và ảnh thư viện đều dùng khóa này.
        </p>
      </div>
    )
  const change = (nextSlot: number, nextVariant: number) =>
    onChange({
      ...draft,
      skillKey: `skill-${nextSlot}-${nextVariant}`,
      kind: nextSlot === 0 ? "PASSIVE" : draft.kind === "PASSIVE" ? "ACTIVE" : draft.kind,
    })
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-sm">
          Ô chiêu
          <select className={control} value={slot} onChange={(event) => change(Number(event.target.value), variant)}>
            {SLOTS.map((value) => (
              <option key={value} value={value}>
                {slotName(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          Biến thể
          <input
            ref={variantField}
            className={control}
            type="number"
            min={1}
            max={99}
            required
            value={variant}
            onChange={(event) => change(slot, Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
          />
        </label>
      </div>
      <p className={taken ? "type-meta text-destructive" : "type-meta"}>
        {taken ? "Đã có chiêu khác dùng ô và biến thể này." : "Khóa tự tạo: "}
        {!taken && <code>{draft.skillKey}</code>}
      </p>
    </div>
  )
}

export function SkillSettings({
  skill,
  locale,
  disabled,
  onApply,
  onRemoveTranslation,
  onRemove,
  usedKeys = new Set(),
  locked = false,
}: {
  skill: Skill
  locale: string
  disabled: boolean
  /** Keys of the other skills, which this one may not take. */
  usedKeys?: ReadonlySet<string>
  /** The key is already saved on the server. */
  locked?: boolean
  onApply: (settings: Settings) => void
  onRemoveTranslation: () => void
  onRemove: () => void
}) {
  const name = selectSkillTranslation(skill, locale)?.name
  return (
    <EditorToolSheet
      title="Thiết lập kỹ năng"
      description={[skillLabel(skill), name].filter(Boolean).join(" · ")}
      value={{ skillKey: skill.skillKey, kind: skill.kind, formKey: skill.formKey }}
      onApply={onApply}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          disabled={disabled}
          aria-label="Thiết lập kỹ năng"
          title="Thiết lập kỹ năng"
        >
          <Settings2 className="size-4" />
        </Button>
      }
    >
      {(draft, update, close) => (
        <>
          <SkillKeyFields skill={skill} draft={draft} usedKeys={usedKeys} locked={locked} onChange={update} />
          <label className="grid gap-1.5 text-sm">
            Loại
            <select
              className={control}
              value={draft.kind}
              onChange={(event) => update({ ...draft, kind: event.target.value as Skill["kind"] })}
            >
              {Object.entries(kindLabels).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Dạng tướng (nếu có)"
            maxLength={64}
            value={draft.formKey ?? ""}
            onChange={(formKey) => update({ ...draft, formKey: formKey || null })}
          />
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {skill.translations.length > 1 && skill.translations.some((text) => text.locale === locale) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  close()
                  onRemoveTranslation()
                }}
              >
                <Trash2 className="size-4" /> Bỏ bản dịch {locale}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                close()
                onRemove()
              }}
            >
              <Trash2 className="size-4" /> Bỏ kỹ năng
            </Button>
          </div>
        </>
      )}
    </EditorToolSheet>
  )
}
