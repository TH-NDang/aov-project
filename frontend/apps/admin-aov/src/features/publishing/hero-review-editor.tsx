import { useState } from "react"
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@aov/ui/components/sheet"
import { heroReviewItems, setHeroReviewResolved } from "./hero-source-review"
import { selectSkillTranslation, skillLabel } from "./hero-skills"
import type { Skill } from "./types"

export function HeroReviewEditor({
  skills,
  locale,
  onChange,
  open: requestedOpen,
  onOpenChange,
  disabled = false,
}: {
  skills: Skill[]
  locale: string
  onChange: (skills: Skill[]) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const items = heroReviewItems(skills, true)
  if (!items.length) return null
  return (
    <Sheet open={requestedOpen ?? localOpen} onOpenChange={onOpenChange ?? setLocalOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          <AlertTriangle className="size-4" /> Đối chiếu cảnh báo
        </Button>
      </SheetTrigger>
      <SheetContent showCloseButton={false} className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="relative shrink-0 pr-14">
          <SheetTitle>Đối chiếu cảnh báo nguồn</SheetTitle>
          <SheetDescription>
            Kiểm tra nội dung trước khi đánh dấu. Đóng bảng này rồi bấm “Lưu phần này” để lưu kết quả.
          </SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute top-3 right-3"
              aria-label="Đóng đối chiếu cảnh báo"
            >
              <X className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <ul className="min-h-0 space-y-3 overflow-y-auto px-4 pb-4" aria-label="Đối chiếu cảnh báo nguồn">
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
      </SheetContent>
    </Sheet>
  )
}
