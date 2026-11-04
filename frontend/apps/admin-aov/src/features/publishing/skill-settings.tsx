import { Settings2, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { EditorToolSheet } from "./editor-tool-sheet"
import { Field, control } from "./fields"
import { selectSkillTranslation, skillLabel } from "./hero-skills"
import type { Skill } from "./types"

const kindLabels: Record<Skill["kind"], string> = { PASSIVE: "Nội tại", ACTIVE: "Chủ động", OTHER: "Khác" }
type Settings = Pick<Skill, "skillKey" | "kind" | "formKey">

export function SkillSettings({
  skill,
  locale,
  disabled,
  onApply,
  onRemoveTranslation,
  onRemove,
}: {
  skill: Skill
  locale: string
  disabled: boolean
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
          <Field
            label="Khóa kỹ năng"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={64}
            value={draft.skillKey}
            onChange={(skillKey) => update({ ...draft, skillKey })}
          />
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
