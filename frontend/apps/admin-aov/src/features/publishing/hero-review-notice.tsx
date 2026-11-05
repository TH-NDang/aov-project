import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { heroReviewNotes } from "./hero-source-details"
import type { Skill } from "./types"

export function HeroReviewNotice({ skills, onReview }: { skills: Skill[]; onReview?: () => void }) {
  const [open, setOpen] = useState(false)
  const notes = heroReviewNotes(skills)
  if (!notes.length) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 text-amber-700 dark:text-amber-400"
          aria-label={`Xem ${notes.length} cảnh báo cần đối chiếu từ nguồn`}
        >
          <AlertTriangle className="size-4" />
          <span className="type-label">Cảnh báo</span>
          <span className="type-label">{notes.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-96 max-w-[calc(100vw-2rem)] rounded-xl"
        aria-label="Ghi chú cần đối chiếu từ nguồn"
      >
        <h3 className="type-section-title">Cảnh báo cần đối chiếu</h3>
        <p className="type-meta mt-1">{notes.length} mục cần đối chiếu trong phiên bản đang xem.</p>
        <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto text-sm leading-6 text-muted-foreground">
          {notes.map((note) => (
            <li key={note} className="border-t pt-3">
              {note}
            </li>
          ))}
        </ul>
        {onReview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setOpen(false)
              onReview()
            }}
          >
            Xử lý cảnh báo
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
