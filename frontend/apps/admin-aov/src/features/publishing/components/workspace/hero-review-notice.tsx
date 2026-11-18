import { useRef, useState } from "react"
import { AlertTriangle, ArrowRight } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { heroReviewItems, type HeroReviewItem } from "../../model/import/hero-source-review"
import { selectSkillTranslation, skillLabel, skillVariantLabel } from "../../model/skills/hero-skills"
import { SECTIONS, type Skill } from "../../api/types"

export function HeroReviewNotice({
  skills,
  locale,
  disabled,
  onNavigate,
  onReview,
}: {
  skills: Skill[]
  locale: string
  disabled: boolean
  onNavigate: (item: HeroReviewItem) => void
  onReview?: () => void
}) {
  const items = heroReviewItems(skills)
  const [open, setOpen] = useState(false)
  const destination = useRef<HeroReviewItem | null>(null)
  const reviewRequested = useRef(false)
  if (!items.length) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 text-(--aov-warning)"
          disabled={disabled}
          aria-label={`Xem ${items.length} cảnh báo cần đối chiếu từ nguồn`}
        >
          <AlertTriangle className="size-4" />
          <span className="type-label">Cảnh báo</span>
          <span className="type-label">{items.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        onCloseAutoFocus={(event) => {
          if (destination.current) {
            event.preventDefault()
            const item = destination.current
            destination.current = null
            queueMicrotask(() => onNavigate(item))
          } else if (reviewRequested.current) {
            event.preventDefault()
            reviewRequested.current = false
            queueMicrotask(() => onReview?.())
          }
        }}
        className="w-96 max-w-[calc(100vw-2rem)] rounded-xl"
        aria-label="Ghi chú cần đối chiếu từ nguồn"
      >
        <h3 className="type-section-title">Cảnh báo cần đối chiếu</h3>
        <p className="type-meta mt-1">Các mục cần kiểm tra trong phiên bản đang xem.</p>
        <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto text-sm leading-6 text-muted-foreground">
          {items.map((item) => {
            const skill = item.skillKey ? skills.find((skill) => skill.skillKey === item.skillKey) : undefined
            const label = skill
              ? [
                  skillLabel(skill),
                  selectSkillTranslation(skill, locale)?.name,
                  skill.formKey || skillVariantLabel(skill, skills),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : item.section === "COMBAT_STATS"
                ? "Thuộc tính chiến đấu"
                : SECTIONS.find(([key]) => key === item.section)?.[2]
            return (
              <li key={JSON.stringify([item.section, item.skillKey, item.note])} className="space-y-1 border-t pt-3">
                <p>{item.note}</p>
                {label ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-sm py-1 text-left text-sm font-medium text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      destination.current = item
                      setOpen(false)
                    }}
                  >
                    Đến {label} <ArrowRight className="size-3.5 shrink-0" />
                  </button>
                ) : (
                  <p className="type-meta">Ghi chú chung · Nguồn chưa chỉ rõ mục liên quan.</p>
                )}
              </li>
            )
          })}
        </ul>
        {onReview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              reviewRequested.current = true
              setOpen(false)
            }}
          >
            Xử lý cảnh báo
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
