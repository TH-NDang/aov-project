import { useState } from "react"
import { AlertTriangle, Send } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"

/**
 * Publishes at once when nothing stands in the way. When something does, or the server refused, the reason and the way
 * to fix it open right beside the button rather than a step away.
 */
export function PublishButton({
  busy,
  publishing,
  issues,
  unsaved,
  patch,
  onReloadPatch,
  reloadingPatch = false,
  failure,
  onDismissFailure,
  onOpenSection,
  onPublish,
}: {
  busy: boolean
  publishing: boolean
  issues: string[]
  unsaved: { key: string; label: string }[]
  /** The draft's patch when that patch has to be published first. */
  patch?: { to: string; code: string; canPublish: boolean }
  /** Set while the state of the draft's patch is unknown. */
  onReloadPatch?: () => void
  reloadingPatch?: boolean
  failure: string
  onDismissFailure: () => void
  onOpenSection: (key: string) => void
  onPublish: () => void
}) {
  const [open, setOpen] = useState(false)
  const blocked = issues.length > 0 || unsaved.length > 0
  return (
    <Popover
      open={open || !!failure}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) onDismissFailure()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={blocked ? "outline" : "default"}
          disabled={busy}
          aria-label={blocked ? "Xuất bản · xem mục còn thiếu" : undefined}
          onClick={(event) => {
            if (blocked) return
            // With nothing to show, this click publishes instead of opening the popover.
            event.preventDefault()
            onDismissFailure()
            onPublish()
          }}
        >
          {blocked ? <AlertTriangle className="size-4 text-amber-600" /> : <Send className="size-4" />}
          {publishing ? "Đang xuất bản…" : "Xuất bản"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        aria-label="Điều kiện xuất bản"
        className="w-80 max-w-[calc(100vw-1.5rem)] space-y-3"
      >
        <p className="type-section-title">{failure ? "Chưa xuất bản được" : "Chưa thể xuất bản"}</p>
        {failure && (
          <p role="alert" className="type-body text-destructive">
            {failure}
          </p>
        )}
        {issues.length > 0 && (
          <ul className="space-y-2">
            {issues.map((issue) => (
              <li key={issue} className="type-body flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                {issue}
              </li>
            ))}
          </ul>
        )}
        {patch && (
          <div className="space-y-1">
            <Button asChild variant="outline" size="sm">
              <Link to={patch.to}>Mở patch {patch.code}</Link>
            </Button>
            {!patch.canPublish && <p className="type-meta">Người có quyền xuất bản patch có thể thực hiện bước này.</p>}
          </div>
        )}
        {onReloadPatch && (
          <Button type="button" variant="outline" size="sm" disabled={reloadingPatch} onClick={onReloadPatch}>
            Tải lại trạng thái patch
          </Button>
        )}
        {unsaved.length > 0 && (
          <div className="space-y-2">
            <p className="type-body">Còn thay đổi chưa lưu. Mở từng phần để lưu hoặc hủy trước khi xuất bản.</p>
            <div className="flex flex-wrap gap-2">
              {unsaved.map(({ key, label }) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false)
                    onOpenSection(key)
                  }}
                >
                  Mở {label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
