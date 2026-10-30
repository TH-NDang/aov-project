import { LoaderCircle, Save, Undo2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"

/**
 * Save controls that appear only while there is something to save, docked to the bottom of the page so they stay in
 * reach while scrolling a long editor.
 */
export function UnsavedBar({
  count,
  busy = false,
  saveDisabled = false,
  onSave,
  onUndo,
  canUndo = false,
  onDiscard,
  saveLabel = "Lưu thay đổi",
  message,
  className,
}: {
  count: number
  /** Replaces the change count when the page cannot count its changes. */
  message?: string
  busy?: boolean
  saveDisabled?: boolean
  onSave: () => void
  onUndo?: () => void
  canUndo?: boolean
  onDiscard?: () => void
  saveLabel?: string
  className?: string
}) {
  if (count <= 0 && !busy) return null
  return (
    <div
      role="region"
      aria-label="Thay đổi chưa lưu"
      className={cn(
        "sticky bottom-3 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2",
        className,
      )}
    >
      <span className="font-medium tabular-nums">{message ?? `${count} thay đổi chưa lưu`}</span>
      {onUndo && (
        <Button type="button" size="sm" variant="ghost" disabled={!canUndo || busy} onClick={onUndo}>
          <Undo2 className="size-4" />
          Hoàn tác
        </Button>
      )}
      {onDiscard && (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDiscard}>
          Bỏ thay đổi
        </Button>
      )}
      <Button type="button" size="sm" disabled={saveDisabled || busy} onClick={onSave}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        {saveLabel}
      </Button>
    </div>
  )
}
