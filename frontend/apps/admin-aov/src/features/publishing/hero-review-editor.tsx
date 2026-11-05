import { Check, RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { heroReviewItems, setHeroReviewResolved } from "./hero-source-review"
import { selectSkillTranslation, skillLabel } from "./hero-skills"
import type { Skill } from "./types"

export function HeroReviewEditor({
  skills,
  locale,
  onChange,
}: {
  skills: Skill[]
  locale: string
  onChange: (skills: Skill[]) => void
}) {
  const items = heroReviewItems(skills, true)
  if (!items.length) return null
  return (
    <details className="rounded-lg border p-3" open>
      <summary className="type-label cursor-pointer">Đối chiếu cảnh báo nguồn</summary>
      <p className="type-meta mt-2">
        Bổ sung và kiểm tra nội dung trước khi đánh dấu. Bấm “Lưu phần này” để lưu kết quả đối chiếu.
      </p>
      <ul className="mt-3 space-y-3" aria-label="Đối chiếu cảnh báo nguồn">
        {items.map((item) => {
          const skill = skills.find((skill) => skill.skillKey === item.skillKey)
          return (
            <li key={JSON.stringify([item.note, item.section, item.skillKey])} className="space-y-2 border-t pt-3">
              {skill && (
                <p className="type-label">
                  {skillLabel(skill)} · {selectSkillTranslation(skill, locale)?.name || skill.skillKey}
                </p>
              )}
              <p className="type-body">{item.note}</p>
              <div className="flex flex-wrap items-center gap-2">
                {item.resolved && <span className="type-meta">Đã đối chiếu</span>}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChange(setHeroReviewResolved(skills, item, !item.resolved))}
                >
                  {item.resolved ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
                  {item.resolved ? "Mở lại cảnh báo" : "Đánh dấu đã đối chiếu"}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
