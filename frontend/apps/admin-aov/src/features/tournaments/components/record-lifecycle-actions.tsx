import { LoaderCircle, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import type { RecordKind } from "../api/tournament-api"
import { useRecordLifecycle, type LifecycleCallbacks, type LifecycleEntry } from "./use-record-lifecycle"

/** The button that moves a record to the trash, or back when it is already there. */
export function RecordLifecycleActions({
  kind,
  entry,
  name,
  disabled = false,
  compact = false,
  ...callbacks
}: LifecycleCallbacks & {
  kind: RecordKind
  entry: LifecycleEntry
  name: string
  disabled?: boolean
  compact?: boolean
}) {
  const { busy, writing, remove, restore, failure } = useRecordLifecycle(kind, callbacks)
  if (entry.deletedAt)
    return (
      <div className="tournament-restore-action">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => void restore(entry)}
        >
          {writing ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}Khôi phục
        </Button>
        {failure}
      </div>
    )
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        className="tournament-delete-trigger text-destructive"
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-label={`Xóa ${name}`}
        title={disabled ? "Lưu hoặc bỏ thay đổi trước khi xóa" : `Xóa ${name}`}
        onClick={() => void remove(entry, name)}
      >
        {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {!compact && "Xóa mục này"}
      </Button>
      {failure}
    </>
  )
}
